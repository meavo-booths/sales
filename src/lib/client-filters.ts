import type { DealClientType } from "@prisma/client";
import { CLIENT_TYPE_OPTIONS } from "@/lib/deal-values";

const CLIENT_TYPES: DealClientType[] = CLIENT_TYPE_OPTIONS;

export const CLIENT_SORT_OPTIONS = [
  { value: "name", label: "Alphabetically" },
  { value: "revenue", label: "Revenue (highest first)" },
  { value: "newest", label: "Newest deal" },
] as const;

export type ClientSort = (typeof CLIENT_SORT_OPTIONS)[number]["value"];

const CLIENT_SORTS = new Set<string>(CLIENT_SORT_OPTIONS.map((o) => o.value));

export function parseClientSort(raw: string | undefined): ClientSort {
  if (raw && CLIENT_SORTS.has(raw)) return raw as ClientSort;
  return "name";
}

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
