import type {
  AddOnProductFamily,
  BoothProductFamily,
  DealClientType,
  ProductKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADDON_FAMILY_LABELS,
  BOOTH_FAMILY_LABELS,
  CLIENT_TYPE_LABELS,
  CLIENT_TYPE_OPTIONS,
  MARKET_OPTIONS,
} from "@/lib/deal-values";
import { isQuoteCurrency, type QuoteCurrency } from "@/lib/exchange-rates";

/** Expected CSV column headers (case-insensitive, trimmed). */
export const CSV_COLUMNS = {
  itemCode: "Item Code",
  itemName: "Item Name",
  taxCode: "Zamp Tax Code",
  type: "Type",
  productFamily: "Product Family",
  currency: "Currency",
  market: "Market",
  clientType: "Client Type",
} as const;

export type ParsedCsvRow = {
  itemCode: string;
  itemName: string;
  taxCode: string;
  type: ProductKind;
  boothFamily: BoothProductFamily | null;
  addOnFamily: AddOnProductFamily | null;
  currency: QuoteCurrency;
  market: string;
  clientTypeInput: string;
  availability: { market: string; clientType: DealClientType }[];
};

export type CsvRowPreview = {
  itemCode: string;
  itemName: string;
  status: "ok" | "error";
  errors: string[];
  warnings: string[];
  plannedChanges: {
    taxCode: string;
    kind: ProductKind;
    family: string;
    currency: QuoteCurrency;
    availability: { market: string; clientType: string }[];
  } | null;
};

export type CsvImportPreview = {
  rows: CsvRowPreview[];
  canImport: boolean;
  csvText: string;
};

export type CsvImportApplyResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

const MARKET_SET = new Set<string>(MARKET_OPTIONS);

const CLIENT_TYPE_BY_LABEL = new Map<string, DealClientType>(
  (Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(([key, label]) => [
    normalizeKey(label),
    key,
  ]),
);

const BOOTH_FAMILY_BY_LABEL = new Map<string, BoothProductFamily>(
  (Object.entries(BOOTH_FAMILY_LABELS) as [BoothProductFamily, string][]).flatMap(
    ([key, label]) => [
      [normalizeKey(label), key],
      [normalizeKey(key), key],
    ],
  ),
);

// Legacy display names so older CSVs still resolve after Haven Two / Haven Four rename.
BOOTH_FAMILY_BY_LABEL.set(normalizeKey("Haven 2"), "HAVEN_2");
BOOTH_FAMILY_BY_LABEL.set(normalizeKey("Haven 4"), "HAVEN_4");

const ADDON_FAMILY_BY_LABEL = new Map<string, AddOnProductFamily>(
  (Object.entries(ADDON_FAMILY_LABELS) as [AddOnProductFamily, string][]).flatMap(
    ([key, label]) => [
      [normalizeKey(label), key],
      [normalizeKey(key), key],
    ],
  ),
);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip UTF-8 BOM and trim. */
function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

/** Minimal RFC4180-style CSV parser (quoted fields, commas, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const input = stripBom(text);
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else if (char === "\r") {
      // ignore — handle \r\n via \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

function headerIndex(headers: string[]): Record<keyof typeof CSV_COLUMNS, number> {
  const normalized = headers.map((h) => h.trim());
  const lookup = new Map(normalized.map((h, index) => [h.toLowerCase(), index]));

  const resolve = (name: string) => {
    const index = lookup.get(name.toLowerCase());
    if (index === undefined) {
      throw new Error(`Missing required column: ${name}`);
    }
    return index;
  };

  return {
    itemCode: resolve(CSV_COLUMNS.itemCode),
    itemName: resolve(CSV_COLUMNS.itemName),
    taxCode: resolve(CSV_COLUMNS.taxCode),
    type: resolve(CSV_COLUMNS.type),
    productFamily: resolve(CSV_COLUMNS.productFamily),
    currency: resolve(CSV_COLUMNS.currency),
    market: resolve(CSV_COLUMNS.market),
    clientType: resolve(CSV_COLUMNS.clientType),
  };
}

export function expandMarkets(market: string): string[] {
  const trimmed = market.trim();
  if (trimmed === "RoW") return ["RoW", "Balkans"];
  return [trimmed];
}

export function expandClientTypes(clientTypeInput: string): DealClientType[] {
  const normalized = normalizeKey(clientTypeInput);
  if (normalized === "both") return [...CLIENT_TYPE_OPTIONS];

  const mapped = CLIENT_TYPE_BY_LABEL.get(normalized);
  if (!mapped) return [];

  if (mapped === "AGENCY") return ["AGENCY", "COWORKING"];
  return [mapped];
}

export function buildAvailability(
  market: string,
  clientTypeInput: string,
): { market: string; clientType: DealClientType }[] {
  const markets = expandMarkets(market);
  const clientTypes = expandClientTypes(clientTypeInput);
  const seen = new Set<string>();
  const rows: { market: string; clientType: DealClientType }[] = [];

  for (const m of markets) {
    for (const clientType of clientTypes) {
      const key = `${m}\0${clientType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ market: m, clientType });
    }
  }

  return rows;
}

function parseKind(raw: string): ProductKind | null {
  const normalized = normalizeKey(raw);
  if (normalized === "booth") return "BOOTH";
  if (normalized === "add-on" || normalized === "addon") return "ADDON";
  return null;
}

function parseFamily(
  kind: ProductKind,
  raw: string,
): { boothFamily: BoothProductFamily | null; addOnFamily: AddOnProductFamily | null; error?: string } {
  if (kind === "ADDON" && !raw.trim()) {
    return { boothFamily: null, addOnFamily: null };
  }

  const key = normalizeKey(raw);
  if (kind === "BOOTH") {
    const boothFamily = BOOTH_FAMILY_BY_LABEL.get(key);
    if (!boothFamily) {
      return {
        boothFamily: null,
        addOnFamily: null,
        error: `Unknown booth product family: ${raw}`,
      };
    }
    return { boothFamily, addOnFamily: null };
  }

  const addOnFamily = ADDON_FAMILY_BY_LABEL.get(key);
  if (!addOnFamily) {
    return {
      boothFamily: null,
      addOnFamily: null,
      error: `Unknown add-on product family: ${raw}`,
    };
  }
  return { boothFamily: null, addOnFamily };
}

function familyDisplay(
  kind: ProductKind,
  boothFamily: BoothProductFamily | null,
  addOnFamily: AddOnProductFamily | null,
): string {
  if (kind === "BOOTH" && boothFamily) return BOOTH_FAMILY_LABELS[boothFamily];
  if (kind === "ADDON" && addOnFamily) return ADDON_FAMILY_LABELS[addOnFamily];
  return "—";
}

function clientTypeLabel(clientType: DealClientType): string {
  return CLIENT_TYPE_LABELS[clientType];
}

function parseRow(cells: string[], index: Record<keyof typeof CSV_COLUMNS, number>): {
  row: ParsedCsvRow | null;
  errors: string[];
} {
  const errors: string[] = [];
  const get = (key: keyof typeof CSV_COLUMNS) => (cells[index[key]] ?? "").trim();

  const itemCode = get("itemCode");
  const itemName = get("itemName");
  const taxCode = get("taxCode");
  const typeRaw = get("type");
  const familyRaw = get("productFamily");
  const currencyRaw = get("currency").toUpperCase();
  const market = get("market");
  const clientTypeInput = get("clientType");

  if (!itemCode) errors.push("Item Code is required");
  if (!itemName) errors.push("Item Name is required");
  if (!typeRaw) errors.push("Type is required");
  if (!currencyRaw) errors.push("Currency is required");
  if (!market) errors.push("Market is required");
  if (!clientTypeInput) errors.push("Client Type is required");

  const kind = typeRaw ? parseKind(typeRaw) : null;
  if (typeRaw && !kind) errors.push(`Unknown type: ${typeRaw}`);

  let boothFamily: BoothProductFamily | null = null;
  let addOnFamily: AddOnProductFamily | null = null;
  if (kind === "BOOTH") {
    if (!familyRaw) {
      errors.push("Product Family is required for booths");
    } else {
      const parsed = parseFamily(kind, familyRaw);
      if (parsed.error) errors.push(parsed.error);
      boothFamily = parsed.boothFamily;
    }
  } else if (kind === "ADDON" && familyRaw) {
    // Optional — most add-on rows leave Product Family empty.
    const parsed = parseFamily(kind, familyRaw);
    if (parsed.error) errors.push(parsed.error);
    addOnFamily = parsed.addOnFamily;
  }

  if (currencyRaw && !isQuoteCurrency(currencyRaw)) {
    errors.push(`Unknown currency: ${currencyRaw}`);
  }

  if (market && !MARKET_SET.has(market)) {
    errors.push(`Unknown market: ${market}`);
  }

  const clientTypes = clientTypeInput ? expandClientTypes(clientTypeInput) : [];
  if (clientTypeInput && clientTypes.length === 0) {
    errors.push(`Unknown client type: ${clientTypeInput}`);
  }

  if (errors.length > 0) return { row: null, errors };

  const availability = buildAvailability(market, clientTypeInput);
  if (availability.length === 0) {
    return { row: null, errors: ["Could not build availability rows"] };
  }

  return {
    row: {
      itemCode,
      itemName,
      taxCode,
      type: kind!,
      boothFamily,
      addOnFamily,
      currency: currencyRaw as QuoteCurrency,
      market,
      clientTypeInput,
      availability,
    },
    errors: [],
  };
}

export function parseProductCsv(text: string): {
  rows: ParsedCsvRow[];
  fileErrors: string[];
} {
  const fileErrors: string[] = [];
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], fileErrors: ["CSV must include a header row and at least one data row"] };
  }

  let index: Record<keyof typeof CSV_COLUMNS, number>;
  try {
    index = headerIndex(grid[0]);
  } catch (error) {
    return {
      rows: [],
      fileErrors: [error instanceof Error ? error.message : "Invalid CSV headers"],
    };
  }

  const rows: ParsedCsvRow[] = [];
  const seenCodes = new Set<string>();

  for (let line = 1; line < grid.length; line += 1) {
    const cells = grid[line];
    const { row, errors } = parseRow(cells, index);
    if (errors.length > 0) {
      fileErrors.push(`Row ${line + 1}: ${errors.join("; ")}`);
      continue;
    }
    if (!row) continue;

    if (seenCodes.has(row.itemCode)) {
      fileErrors.push(`Row ${line + 1}: duplicate Item Code "${row.itemCode}" in file`);
      continue;
    }
    seenCodes.add(row.itemCode);
    rows.push(row);
  }

  return { rows, fileErrors };
}

type ExistingProduct = {
  id: string;
  name: string;
  xeroItemCode: string | null;
};

export async function previewProductCsvImport(csvText: string): Promise<CsvImportPreview> {
  const { rows, fileErrors } = parseProductCsv(csvText);
  const previews: CsvRowPreview[] = [];

  if (fileErrors.length > 0 && rows.length === 0) {
    return {
      rows: fileErrors.map((message) => ({
        itemCode: "—",
        itemName: "—",
        status: "error" as const,
        errors: [message],
        warnings: [],
        plannedChanges: null,
      })),
      canImport: false,
      csvText,
    };
  }

  const products = await prisma.product.findMany({
    where: { xeroItemCode: { in: rows.map((row) => row.itemCode) } },
    select: { id: true, name: true, xeroItemCode: true },
  });
  const byCode = new Map(
    products
      .filter((product): product is ExistingProduct & { xeroItemCode: string } =>
        Boolean(product.xeroItemCode),
      )
      .map((product) => [product.xeroItemCode, product]),
  );

  for (const row of rows) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const product = byCode.get(row.itemCode);

    if (!product) {
      errors.push(`No product found with Xero Item Code "${row.itemCode}" — sync from Xero first`);
    } else if (product.name.trim().toLowerCase() !== row.itemName.trim().toLowerCase()) {
      errors.push(
        `Item Name mismatch: CSV has "${row.itemName}" but product is "${product.name}"`,
      );
    }

    previews.push({
      itemCode: row.itemCode,
      itemName: row.itemName,
      status: errors.length > 0 ? "error" : "ok",
      errors,
      warnings,
      plannedChanges:
        errors.length > 0
          ? null
          : {
              taxCode: row.taxCode,
              kind: row.type,
              family: familyDisplay(row.type, row.boothFamily, row.addOnFamily),
              currency: row.currency,
              availability: row.availability.map((entry) => ({
                market: entry.market,
                clientType: clientTypeLabel(entry.clientType),
              })),
            },
    });
  }

  const rowErrors = previews.flatMap((preview) => preview.errors);
  const canImport =
    rows.length > 0 && fileErrors.length === 0 && rowErrors.length === 0 && previews.every(
      (preview) => preview.status === "ok",
    );

  if (fileErrors.length > 0) {
    for (const message of fileErrors) {
      previews.push({
        itemCode: "—",
        itemName: "—",
        status: "error",
        errors: [message],
        warnings: [],
        plannedChanges: null,
      });
    }
  }

  return { rows: previews, canImport, csvText };
}

export async function applyProductCsvImport(csvText: string): Promise<CsvImportApplyResult> {
  const preview = await previewProductCsvImport(csvText);
  if (!preview.canImport) {
    const errors = preview.rows.flatMap((row) => row.errors);
    return { updated: 0, skipped: preview.rows.length, errors };
  }

  const { rows } = parseProductCsv(csvText);
  const products = await prisma.product.findMany({
    where: { xeroItemCode: { in: rows.map((row) => row.itemCode) } },
    select: { id: true, name: true, xeroItemCode: true },
  });
  const byCode = new Map(
    products
      .filter((product): product is ExistingProduct & { xeroItemCode: string } =>
        Boolean(product.xeroItemCode),
      )
      .map((product) => [product.xeroItemCode, product]),
  );

  let updated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const product = byCode.get(row.itemCode);
    if (!product) {
      errors.push(`Skipped ${row.itemCode}: product not found`);
      continue;
    }
    if (product.name.trim().toLowerCase() !== row.itemName.trim().toLowerCase()) {
      errors.push(`Skipped ${row.itemCode}: name mismatch`);
      continue;
    }

    try {
      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: {
            taxCode: row.taxCode,
            kind: row.type,
            boothFamily: row.type === "BOOTH" ? row.boothFamily : null,
            addOnFamily: row.type === "ADDON" ? row.addOnFamily : null,
            currency: row.currency,
          },
        }),
        prisma.productAvailability.deleteMany({ where: { productId: product.id } }),
        prisma.productAvailability.createMany({
          data: row.availability.map((entry) => ({
            productId: product.id,
            market: entry.market,
            clientType: entry.clientType,
          })),
        }),
      ]);
      updated += 1;
    } catch (error) {
      errors.push(
        `Failed ${row.itemCode}: ${error instanceof Error ? error.message : "update failed"}`,
      );
    }
  }

  return {
    updated,
    skipped: rows.length - updated,
    errors,
  };
}
