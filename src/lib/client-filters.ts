import type { DealClientType } from "@prisma/client";

const CLIENT_TYPES: DealClientType[] = ["DIRECT", "AGENCY", "COWORKING"];

function splitValues(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function parseClientFilterValues(
  raw: string | string[] | undefined,
): string[] {
  const values: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) values.push(...splitValues(entry));
  } else if (typeof raw === "string" && raw.trim()) {
    values.push(...splitValues(raw));
  }
  return uniqueValues(values);
}

export function parseClientTypeFilters(
  raw: string | string[] | undefined,
): DealClientType[] {
  return parseClientFilterValues(raw).filter((value): value is DealClientType =>
    CLIENT_TYPES.includes(value as DealClientType),
  );
}

export function appendFilterParams(
  params: URLSearchParams,
  key: string,
  values: string[],
): void {
  for (const value of uniqueValues(values)) {
    params.append(key, value);
  }
}

export { parseClientHierarchyView, type ClientHierarchyView } from "@/lib/client-hierarchy";
