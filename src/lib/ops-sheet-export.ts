import type { Prisma } from "@prisma/client";
import {
  OPS_SHEET_TAB,
  columnLetter,
  getOpsSpreadsheetId,
  getSheetsClient,
  isOpsSheetConfigured,
} from "@/lib/sheets-client";
import { CLIENT_TYPE_LABELS, formatSheetDate } from "@/lib/deal-values";
import { lineItemAmountEur } from "@/lib/line-item-eur";
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
  clientName: ["customer", "client", "client_name", "company", "company_name"],
  model: ["model", "product", "booth_model", "models"],
  quantity: ["booths", "no_of_booths", "number_of_booths", "no_booths", "qty", "quantity", "units"],
  addOns: ["add_ons", "addons", "add_on", "extras"],
};

export type OpsSheetRowRef = {
  suffix: string;
  rowNumber: number | null;
  model: string;
  quantity: number;
  addOns: string;
  amount: string;
};

type ExportGroup = {
  suffix: string;
  /** Empty for the standalone add-ons row. */
  model: string;
  /** Null for the standalone add-ons row — the booths column stays empty. */
  quantity: number | null;
  addOns: string[];
  amount: number;
};

export type DealForExport = Prisma.DealGetPayload<{
  include: { lineItems: { include: { product: true } } };
}>;

function addOnLabel(item: DealForExport["lineItems"][number]): string {
  const name = item.product?.name ?? item.customName;
  return item.quantity > 1 ? `${item.quantity}x ${name}` : name;
}

/**
 * Group booth line items by model + finish; one Ops File row per group.
 * Add-ons attached to a booth line join that booth's row: names in the
 * Add-ons column, value added to the row's amount. Standalone add-ons get
 * one extra suffix row with Model/Booths left empty.
 */
export function buildExportGroups(deal: DealForExport): ExportGroup[] {
  const groups = new Map<string, ExportGroup>();
  const sorted = [...deal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  const booths = sorted.filter((item) => item.product?.kind === "BOOTH");
  // Custom one-off lines (no product) travel with the standalone add-ons row
  // so the Ops File amounts still add up to the quote total.
  const addOns = sorted.filter((item) => item.product?.kind === "ADDON" || !item.product);
  // Booth-group key per booth line id, so attached add-ons can find their row.
  const groupKeyByLineId = new Map<string, string>();

  for (const item of booths) {
    const key = `${item.productId}::${item.finish}`;
    groupKeyByLineId.set(item.id, key);
    const amount = lineItemAmountEur(item);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity = (existing.quantity ?? 0) + item.quantity;
      existing.amount += amount;
    } else {
      groups.set(key, {
        suffix: "",
        model: item.product!.name,
        quantity: item.quantity,
        addOns: [],
        amount,
      });
    }
  }

  const standalone: ExportGroup = {
    suffix: "",
    model: "",
    quantity: null,
    addOns: [],
    amount: 0,
  };

  for (const item of addOns) {
    const amount = lineItemAmountEur(item);
    const parentKey = item.parentLineItemId
      ? groupKeyByLineId.get(item.parentLineItemId)
      : undefined;
    const boothGroup = parentKey ? groups.get(parentKey) : undefined;
    if (boothGroup) {
      boothGroup.addOns.push(addOnLabel(item));
      boothGroup.amount += amount;
    } else {
      standalone.addOns.push(addOnLabel(item));
      standalone.amount += amount;
    }
  }

  const result = [...groups.values()];
  if (standalone.addOns.length > 0) result.push(standalone);

  // First row keeps the plain DealID; later rows get a, b, ..., z, aa, ab, ...
  return result.map((group, index) => ({
    ...group,
    suffix: index === 0 ? "" : letterSuffix(index),
  }));
}

/** 1 -> "a", 26 -> "z", 27 -> "aa" (bijective base-26). */
export function letterSuffix(index: number): string {
  let n = index;
  let suffix = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    suffix = String.fromCharCode(97 + remainder) + suffix;
    n = Math.floor((n - 1) / 26);
  }
  return suffix;
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

  const sheetDate = formatSheetDate(deal.paymentPoDate ?? deal.dealDate);

  const rows = groups.map((group) => {
    const cells = new Map<number, string>();
    const set = (field: string, value: string) => {
      const index = columns.get(field);
      if (index !== undefined) cells.set(index, value);
    };

    set("dealId", `${deal.dealId}${group.suffix}`);
    set("invoiceDate", sheetDate);
    set("salesRep", deal.salesRep);
    set("amount", group.amount.toFixed(2));
    set("market", deal.market);
    set("clientType", CLIENT_TYPE_LABELS[deal.clientType]);
    set("clientName", deal.clientName);
    // Standalone add-on rows leave Model and the booths count empty.
    if (group.model) set("model", group.model);
    if (group.quantity !== null) set("quantity", String(group.quantity));
    if (group.addOns.length > 0) set("addOns", group.addOns.join(", "));
    return cells;
  });

  // The sheet has protected columns (e.g. the finance-only "Amount Collected")
  // between the ones we write. Sheets rejects any single-range write whose
  // span crosses a protected column, even with null placeholders, and
  // values.append is rejected outright because it expands the grid across the
  // unbounded protected ranges. So: find the first empty row in the DealID
  // column, then write each contiguous run of mapped columns as its own range
  // so protected columns are never part of any written range.
  const dealIdColumn = columnLetter(columns.get("dealId")!);
  const columnResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${OPS_SHEET_TAB}'!${dealIdColumn}:${dealIdColumn}`,
    majorDimension: "COLUMNS",
  });
  const columnValues = (columnResponse.data.values?.[0] ?? []).map((v) =>
    String(v ?? "").trim()
  );
  const firstRow = columnValues.length + 1;

  // Idempotency guard: if a previous export attempt already wrote rows for
  // this deal (e.g. the sheet write succeeded but the DB bookkeeping failed
  // before a retry), reuse the existing rows instead of appending duplicates.
  const existingRowByKey = new Map<string, number>();
  columnValues.forEach((value, index) => {
    if (value) existingRowByKey.set(value, index + 1);
  });
  const alreadyWritten = groups.filter((group) =>
    existingRowByKey.has(`${deal.dealId}${group.suffix}`)
  );
  if (alreadyWritten.length === groups.length) {
    return groups.map((group) => ({
      suffix: group.suffix,
      rowNumber: existingRowByKey.get(`${deal.dealId}${group.suffix}`) ?? null,
      model: group.model,
      quantity: group.quantity ?? 0,
      addOns: group.addOns.join(", "),
      amount: group.amount.toFixed(2),
    }));
  }
  if (alreadyWritten.length > 0) {
    throw new Error(
      `Ops File already contains ${alreadyWritten.length} of ${groups.length} rows for deal ${deal.dealId} — resolve manually before retrying`
    );
  }

  const data: { range: string; values: string[][] }[] = [];
  rows.forEach((cells, rowOffset) => {
    const indexes = [...cells.keys()].sort((a, b) => a - b);
    let run: number[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const rowNumber = firstRow + rowOffset;
      data.push({
        range: `'${OPS_SHEET_TAB}'!${columnLetter(run[0])}${rowNumber}:${columnLetter(run[run.length - 1])}${rowNumber}`,
        values: [run.map((index) => cells.get(index)!)],
      });
      run = [];
    };
    for (const index of indexes) {
      if (run.length > 0 && index !== run[run.length - 1] + 1) flush();
      run.push(index);
    }
    flush();
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return groups.map((group, index) => ({
    suffix: group.suffix,
    rowNumber: firstRow + index,
    model: group.model,
    quantity: group.quantity ?? 0,
    addOns: group.addOns.join(", "),
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
    console.error(`Ops File sync failed for deal ${deal.dealId}:`, error);
    const message = error instanceof Error ? error.message : "Ops File sync failed";
    await prisma.deal.update({
      where: { id: deal.id },
      data: { sheetSyncError: message },
    });
  }
}
