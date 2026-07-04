import type { Prisma } from "@prisma/client";
import {
  OPS_SHEET_TAB,
  columnLetter,
  getOpsSpreadsheetId,
  getSheetsClient,
  isOpsSheetConfigured,
} from "@/lib/sheets-client";
import { CLIENT_TYPE_LABELS, formatSheetDate } from "@/lib/deal-values";
import { prisma } from "@/lib/prisma";

/**
 * Ops File write-back. When a quote is won, the deal is appended to the Ops
 * File the same way the team enters it manually: line items grouped by
 * model + finish, one row per group. The first row uses the plain DealID
 * (e.g. "XXXX"), subsequent rows get letter suffixes ("XXXXa", "XXXXb", ...).
 * Each row carries the group's quantity and its share of the deal value.
 *
 * Columns are resolved from the sheet's header row (row 1) using the same
 * slugification as the gateway import, so column order changes don't break
 * the export. Headers we can't find are simply left blank.
 */

function slugifyHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Candidate slugified headers per logical field (first match wins). */
const FIELD_HEADER_ALIASES: Record<string, string[]> = {
  dealId: ["inv_number_po_number"],
  invoiceDate: ["inv_po_date"],
  salesRep: ["sales_rep"],
  amount: ["invoice_amount_excl_vat"],
  market: ["market"],
  clientType: ["client_type"],
  clientName: ["client", "client_name", "company", "company_name"],
  model: ["model", "product", "booth_model", "models"],
  quantity: ["booths", "no_of_booths", "number_of_booths", "no_booths", "qty", "quantity", "units"],
};

export type OpsSheetRowRef = {
  suffix: string;
  rowNumber: number | null;
  model: string;
  quantity: number;
  amount: string;
};

type ExportGroup = {
  suffix: string;
  model: string;
  quantity: number;
  amount: number;
};

export type DealForExport = Prisma.DealGetPayload<{
  include: { lineItems: { include: { product: true } } };
}>;

/** Group line items by model + finish; one Ops File row per group. */
export function buildExportGroups(deal: DealForExport): ExportGroup[] {
  const groups = new Map<string, ExportGroup>();

  const sorted = [...deal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of sorted) {
    const key = `${item.productId}::${item.finish}`;
    const amount = item.quantity * Number(item.unitPrice);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.amount += amount;
    } else {
      groups.set(key, {
        suffix: "",
        model: item.product.name,
        quantity: item.quantity,
        amount,
      });
    }
  }

  // First row keeps the plain DealID; later rows get a, b, c, ...
  return [...groups.values()].map((group, index) => ({
    ...group,
    suffix: index === 0 ? "" : String.fromCharCode(96 + index), // 1 -> "a"
  }));
}

function resolveColumns(headers: string[]): Map<string, number> {
  const slugToIndex = new Map<string, number>();
  headers.forEach((header, index) => {
    const slug = slugifyHeader(header);
    if (slug && !slugToIndex.has(slug)) slugToIndex.set(slug, index);
  });

  const fieldToIndex = new Map<string, number>();
  for (const [field, aliases] of Object.entries(FIELD_HEADER_ALIASES)) {
    for (const alias of aliases) {
      const index = slugToIndex.get(alias);
      if (index !== undefined) {
        fieldToIndex.set(field, index);
        break;
      }
    }
  }
  return fieldToIndex;
}

function parseAppendedRowNumber(updatedRange: string | null | undefined): number | null {
  if (!updatedRange) return null;
  const match = updatedRange.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) : null;
}

async function appendDealRows(deal: DealForExport, groups: ExportGroup[]): Promise<OpsSheetRowRef[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getOpsSpreadsheetId();

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${OPS_SHEET_TAB}'!1:1`,
  });
  const headers = (headerResponse.data.values?.[0] ?? []).map((v) => String(v ?? ""));
  if (headers.length === 0) throw new Error("Ops File header row is empty");

  const columns = resolveColumns(headers);
  if (!columns.has("dealId")) {
    throw new Error("Ops File is missing the DealID (INV number/PO number) column");
  }

  const lastColumnIndex = headers.length - 1;
  const sheetDate = formatSheetDate(deal.paymentPoDate ?? deal.dealDate);

  const rows = groups.map((group) => {
    const row = new Array<string>(lastColumnIndex + 1).fill("");
    const set = (field: string, value: string) => {
      const index = columns.get(field);
      if (index !== undefined) row[index] = value;
    };

    set("dealId", `${deal.dealId}${group.suffix}`);
    set("invoiceDate", sheetDate);
    set("salesRep", deal.salesRep);
    set("amount", group.amount.toFixed(2));
    set("market", deal.market);
    set("clientType", CLIENT_TYPE_LABELS[deal.clientType]);
    set("clientName", deal.clientName);
    set("model", group.model);
    set("quantity", String(group.quantity));
    return row;
  });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${OPS_SHEET_TAB}'!A:${columnLetter(lastColumnIndex)}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });

  const firstRow = parseAppendedRowNumber(response.data.updates?.updatedRange);

  return groups.map((group, index) => ({
    suffix: group.suffix,
    rowNumber: firstRow === null ? null : firstRow + index,
    model: group.model,
    quantity: group.quantity,
    amount: group.amount.toFixed(2),
  }));
}

/**
 * Export a won deal to the Ops File. Records row references or the error on
 * the Deal; never throws, so a sheet outage doesn't block the conversion.
 */
export async function exportDealToOpsSheet(dealDbId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    include: { lineItems: { include: { product: true } } },
  });
  if (!deal || !deal.dealId) return;

  if (!isOpsSheetConfigured()) {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { sheetSyncError: "Ops File sync is not configured" },
    });
    return;
  }

  try {
    const groups = buildExportGroups(deal);
    if (groups.length === 0) throw new Error("Deal has no line items");

    const rowRefs = await appendDealRows(deal, groups);
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        sheetRows: rowRefs,
        sheetSyncedAt: new Date(),
        sheetSyncError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ops File sync failed";
    await prisma.deal.update({
      where: { id: deal.id },
      data: { sheetSyncError: message },
    });
  }
}
