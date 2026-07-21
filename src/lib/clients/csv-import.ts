import type { DealClientType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CLIENT_MARKET_OPTIONS, CLIENT_TYPE_LABELS } from "@/lib/deal-values";

export type ClientCsvMode = "parent" | "normal";

export const PARENT_CSV_COLUMNS = {
  name: "Parent Company Name",
  market: "Market",
  clientType: "Client Type",
} as const;

export const NORMAL_CSV_COLUMNS = {
  name: "Company Name",
  website: "Company URL",
  clientType: "Client Type",
  market: "Market",
  parentCompany: "Parent Company",
} as const;

export type ClientCsvRowStatus = "ok" | "skipped" | "error";

export type ClientCsvRowPreview = {
  rowNumber: number;
  name: string;
  status: ClientCsvRowStatus;
  message: string;
  /** Present when status === "ok" — ready to create. */
  create?: {
    name: string;
    market: string;
    clientType: DealClientType;
    website: string;
    parentClientId: string | null;
    isGroupAccount: boolean;
  };
};

export type ClientCsvImportPreview = {
  mode: ClientCsvMode;
  rows: ClientCsvRowPreview[];
  canImport: boolean;
  csvText: string;
  fileErrors: string[];
  okCount: number;
  skippedCount: number;
  errorCount: number;
};

export type ClientCsvImportApplyResult = {
  created: number;
  skipped: number;
  errors: string[];
};

const MARKET_SET = new Set<string>(CLIENT_MARKET_OPTIONS);

const CLIENT_TYPE_BY_KEY = new Map<string, DealClientType>(
  (Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).flatMap(([key, label]) => [
    [normalizeKey(label), key],
    [normalizeKey(key), key],
  ]),
);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

/** Minimal RFC4180-style CSV parser (quoted fields, commas, newlines in quotes). */
export function parseClientCsv(text: string): string[][] {
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

function cellAt(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

function resolveClientType(raw: string): DealClientType | null {
  if (!raw.trim()) return null;
  return CLIENT_TYPE_BY_KEY.get(normalizeKey(raw)) ?? null;
}

function resolveMarket(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (MARKET_SET.has(trimmed)) return trimmed;
  // Case-insensitive match to canonical option spelling.
  const hit = CLIENT_MARKET_OPTIONS.find((m) => normalizeKey(m) === normalizeKey(trimmed));
  return hit ?? null;
}

function headerLookup(headers: string[]): Map<string, number> {
  return new Map(headers.map((h, index) => [h.trim().toLowerCase(), index]));
}

function requireColumn(
  lookup: Map<string, number>,
  name: string,
  fileErrors: string[],
): number | undefined {
  const index = lookup.get(name.toLowerCase());
  if (index === undefined) {
    fileErrors.push(`Missing required column: ${name}`);
    return undefined;
  }
  return index;
}

type ParentNameMap = {
  /** lower(name) → id when unique; null when ambiguous. */
  byName: Map<string, string | null>;
};

async function loadExistingClientNames(): Promise<Set<string>> {
  const rows = await prisma.client.findMany({ select: { name: true } });
  return new Set(rows.map((row) => normalizeKey(row.name)));
}

async function loadParentNameMap(): Promise<ParentNameMap> {
  const rows = await prisma.client.findMany({
    where: { parentClientId: null },
    select: { id: true, name: true },
  });
  const byName = new Map<string, string | null>();
  for (const row of rows) {
    const key = normalizeKey(row.name);
    if (byName.has(key)) {
      byName.set(key, null); // ambiguous
    } else {
      byName.set(key, row.id);
    }
  }
  return { byName };
}

function parseParentRows(
  dataRows: string[][],
  cols: { name: number; market: number; clientType: number },
  existingNames: Set<string>,
): ClientCsvRowPreview[] {
  const seenInFile = new Set<string>();
  const previews: ClientCsvRowPreview[] = [];

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based data row after header
    const name = cellAt(row, cols.name);
    const marketRaw = cellAt(row, cols.market);
    const typeRaw = cellAt(row, cols.clientType);
    const nameKey = normalizeKey(name);

    const errors: string[] = [];
    if (!name) errors.push("Parent Company Name is required");
    const market = resolveMarket(marketRaw);
    if (!marketRaw) errors.push("Market is required");
    else if (!market) errors.push(`Unknown market: ${marketRaw}`);
    const clientType = resolveClientType(typeRaw);
    if (!typeRaw) errors.push("Client Type is required");
    else if (!clientType) errors.push(`Unknown client type: ${typeRaw}`);

    if (errors.length > 0) {
      previews.push({
        rowNumber,
        name: name || `(row ${rowNumber})`,
        status: "error",
        message: errors.join(" · "),
      });
      return;
    }

    if (existingNames.has(nameKey) || seenInFile.has(nameKey)) {
      previews.push({
        rowNumber,
        name,
        status: "skipped",
        message: existingNames.has(nameKey)
          ? "A client with this name already exists"
          : "Duplicate name earlier in this file",
      });
      seenInFile.add(nameKey);
      return;
    }

    seenInFile.add(nameKey);
    previews.push({
      rowNumber,
      name,
      status: "ok",
      message: "Ready to create as parent / group account",
      create: {
        name,
        market: market!,
        clientType: clientType!,
        website: "",
        parentClientId: null,
        isGroupAccount: true,
      },
    });
  });

  return previews;
}

function parseNormalRows(
  dataRows: string[][],
  cols: {
    name: number;
    website: number;
    clientType: number;
    market: number;
    parentCompany: number | undefined;
  },
  existingNames: Set<string>,
  parents: ParentNameMap,
): ClientCsvRowPreview[] {
  const seenInFile = new Set<string>();
  const previews: ClientCsvRowPreview[] = [];

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cellAt(row, cols.name);
    const website = cellAt(row, cols.website);
    const typeRaw = cellAt(row, cols.clientType);
    const marketRaw = cellAt(row, cols.market);
    const parentName = cellAt(row, cols.parentCompany);
    const nameKey = normalizeKey(name);

    const errors: string[] = [];
    if (!name) errors.push("Company Name is required");
    if (!website) errors.push("Company URL is required");
    const market = resolveMarket(marketRaw);
    if (!marketRaw) errors.push("Market is required");
    else if (!market) errors.push(`Unknown market: ${marketRaw}`);
    const clientType = resolveClientType(typeRaw);
    if (!typeRaw) errors.push("Client Type is required");
    else if (!clientType) errors.push(`Unknown client type: ${typeRaw}`);

    let parentClientId: string | null = null;
    if (parentName) {
      const parentKey = normalizeKey(parentName);
      if (!parents.byName.has(parentKey)) {
        errors.push(`Parent company not found: ${parentName}`);
      } else {
        const id = parents.byName.get(parentKey);
        if (id === null) {
          errors.push(`Ambiguous parent company name: ${parentName}`);
        } else {
          parentClientId = id ?? null;
        }
      }
    }

    if (errors.length > 0) {
      previews.push({
        rowNumber,
        name: name || `(row ${rowNumber})`,
        status: "error",
        message: errors.join(" · "),
      });
      return;
    }

    if (existingNames.has(nameKey) || seenInFile.has(nameKey)) {
      previews.push({
        rowNumber,
        name,
        status: "skipped",
        message: existingNames.has(nameKey)
          ? "A client with this name already exists"
          : "Duplicate name earlier in this file",
      });
      seenInFile.add(nameKey);
      return;
    }

    seenInFile.add(nameKey);
    previews.push({
      rowNumber,
      name,
      status: "ok",
      message: parentClientId
        ? `Ready to create under ${parentName}`
        : "Ready to create (standalone)",
      create: {
        name,
        market: market!,
        clientType: clientType!,
        website,
        parentClientId,
        isGroupAccount: false,
      },
    });
  });

  return previews;
}

export async function previewClientCsvImport(
  mode: ClientCsvMode,
  csvText: string,
): Promise<ClientCsvImportPreview> {
  const fileErrors: string[] = [];
  const grid = parseClientCsv(csvText);
  if (grid.length === 0) {
    return {
      mode,
      rows: [],
      canImport: false,
      csvText,
      fileErrors: ["CSV file is empty"],
      okCount: 0,
      skippedCount: 0,
      errorCount: 0,
    };
  }

  const [header, ...dataRows] = grid;
  const lookup = headerLookup(header);
  let rows: ClientCsvRowPreview[] = [];

  if (mode === "parent") {
    const nameCol = requireColumn(lookup, PARENT_CSV_COLUMNS.name, fileErrors);
    const marketCol = requireColumn(lookup, PARENT_CSV_COLUMNS.market, fileErrors);
    const typeCol = requireColumn(lookup, PARENT_CSV_COLUMNS.clientType, fileErrors);
    if (fileErrors.length === 0 && nameCol !== undefined && marketCol !== undefined && typeCol !== undefined) {
      const existingNames = await loadExistingClientNames();
      rows = parseParentRows(dataRows, { name: nameCol, market: marketCol, clientType: typeCol }, existingNames);
    }
  } else {
    const nameCol = requireColumn(lookup, NORMAL_CSV_COLUMNS.name, fileErrors);
    const websiteCol = requireColumn(lookup, NORMAL_CSV_COLUMNS.website, fileErrors);
    const typeCol = requireColumn(lookup, NORMAL_CSV_COLUMNS.clientType, fileErrors);
    const marketCol = requireColumn(lookup, NORMAL_CSV_COLUMNS.market, fileErrors);
    // Parent Company is optional as a column — if missing, treat as blank for all rows.
    const parentCol = lookup.get(NORMAL_CSV_COLUMNS.parentCompany.toLowerCase());
    if (
      fileErrors.length === 0 &&
      nameCol !== undefined &&
      websiteCol !== undefined &&
      typeCol !== undefined &&
      marketCol !== undefined
    ) {
      const [existingNames, parents] = await Promise.all([
        loadExistingClientNames(),
        loadParentNameMap(),
      ]);
      rows = parseNormalRows(
        dataRows,
        {
          name: nameCol,
          website: websiteCol,
          clientType: typeCol,
          market: marketCol,
          parentCompany: parentCol,
        },
        existingNames,
        parents,
      );
    }
  }

  if (fileErrors.length === 0 && dataRows.length === 0) {
    fileErrors.push("CSV has a header but no data rows");
  }

  const okCount = rows.filter((r) => r.status === "ok").length;
  const skippedCount = rows.filter((r) => r.status === "skipped").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return {
    mode,
    rows,
    canImport: fileErrors.length === 0 && okCount >= 1,
    csvText,
    fileErrors,
    okCount,
    skippedCount,
    errorCount,
  };
}

export async function applyClientCsvImport(
  mode: ClientCsvMode,
  csvText: string,
): Promise<ClientCsvImportApplyResult> {
  const preview = await previewClientCsvImport(mode, csvText);
  if (preview.fileErrors.length > 0) {
    return { created: 0, skipped: preview.skippedCount, errors: preview.fileErrors };
  }

  let created = 0;
  const errors: string[] = [];

  for (const row of preview.rows) {
    if (row.status !== "ok" || !row.create) continue;
    const data = row.create;
    try {
      await prisma.client.create({
        data: {
          name: data.name,
          market: data.market,
          clientType: data.clientType,
          website: data.website,
          registeredAddress: "",
          vatNumber: "",
          isVip: false,
          parentClientId: data.parentClientId,
        },
      });
      created += 1;
    } catch (error) {
      errors.push(
        `Row ${row.rowNumber} (${row.name}): ${
          error instanceof Error ? error.message : "Could not create client"
        }`,
      );
    }
  }

  return {
    created,
    skipped: preview.skippedCount,
    errors,
  };
}
