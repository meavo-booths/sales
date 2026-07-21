import type { AddOnProductFamily, BoothProductFamily, DealClientType, Prisma } from "@prisma/client";
import {
  ADDON_FAMILY_OPTIONS,
  BOOTH_FAMILY_OPTIONS,
  CLIENT_TYPE_OPTIONS,
} from "@/lib/deal-values";

const CLIENT_TYPES: DealClientType[] = CLIENT_TYPE_OPTIONS;

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

export function parseProductFilterValues(
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

export function parseMarketFilters(raw: string | string[] | undefined): string[] {
  return parseProductFilterValues(raw);
}

export function parseClientTypeFilters(
  raw: string | string[] | undefined,
): DealClientType[] {
  return parseProductFilterValues(raw).filter((value): value is DealClientType =>
    CLIENT_TYPES.includes(value as DealClientType),
  );
}

export function parseFamilyFilters(raw: string | string[] | undefined): {
  boothFamilies: BoothProductFamily[];
  addOnFamilies: AddOnProductFamily[];
} {
  const values = parseProductFilterValues(raw);
  const boothSet = new Set(BOOTH_FAMILY_OPTIONS);
  const addOnSet = new Set(ADDON_FAMILY_OPTIONS);
  const boothFamilies: BoothProductFamily[] = [];
  const addOnFamilies: AddOnProductFamily[] = [];
  for (const value of values) {
    if (boothSet.has(value as BoothProductFamily)) {
      boothFamilies.push(value as BoothProductFamily);
    } else if (addOnSet.has(value as AddOnProductFamily)) {
      addOnFamilies.push(value as AddOnProductFamily);
    }
  }
  return { boothFamilies, addOnFamilies };
}

function availabilityWhere(
  markets: string[],
  clientTypes: DealClientType[],
): Prisma.ProductWhereInput | null {
  if (markets.length === 0 && clientTypes.length === 0) return null;

  if (markets.length > 0 && clientTypes.length > 0) {
    return {
      OR: [
        { availability: { none: {} } },
        {
          availability: {
            some: {
              market: { in: markets },
              clientType: { in: clientTypes },
            },
          },
        },
      ],
    };
  }

  if (markets.length > 0) {
    return {
      OR: [
        { availability: { none: {} } },
        { availability: { some: { market: { in: markets } } } },
      ],
    };
  }

  return {
    OR: [
      { availability: { none: {} } },
      { availability: { some: { clientType: { in: clientTypes } } } },
    ],
  };
}

function familyWhere(
  boothFamilies: BoothProductFamily[],
  addOnFamilies: AddOnProductFamily[],
): Prisma.ProductWhereInput | null {
  if (boothFamilies.length === 0 && addOnFamilies.length === 0) return null;

  const or: Prisma.ProductWhereInput[] = [];
  if (boothFamilies.length > 0) or.push({ boothFamily: { in: boothFamilies } });
  if (addOnFamilies.length > 0) or.push({ addOnFamily: { in: addOnFamilies } });
  return { OR: or };
}

export function buildProductWhereInput(filters: {
  search: string;
  markets: string[];
  clientTypes: DealClientType[];
  boothFamilies: BoothProductFamily[];
  addOnFamilies: AddOnProductFamily[];
}): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  const q = filters.search.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { xeroItemCode: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const availability = availabilityWhere(filters.markets, filters.clientTypes);
  if (availability) and.push(availability);

  const family = familyWhere(filters.boothFamilies, filters.addOnFamilies);
  if (family) and.push(family);

  return and.length > 0 ? { AND: and } : {};
}

export function hasProductFilters(filters: {
  search: string;
  markets: string[];
  clientTypes: DealClientType[];
  boothFamilies: BoothProductFamily[];
  addOnFamilies: AddOnProductFamily[];
}): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.markets.length > 0 ||
    filters.clientTypes.length > 0 ||
    filters.boothFamilies.length > 0 ||
    filters.addOnFamilies.length > 0
  );
}

export function appendProductFilterParams(
  params: URLSearchParams,
  filters: {
    search: string;
    markets: string[];
    clientTypes: DealClientType[];
    boothFamilies: BoothProductFamily[];
    addOnFamilies: AddOnProductFamily[];
  },
): void {
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.markets.length > 0) params.set("market", filters.markets.join(","));
  if (filters.clientTypes.length > 0) params.set("type", filters.clientTypes.join(","));
  const families = [...filters.boothFamilies, ...filters.addOnFamilies];
  if (families.length > 0) params.set("family", families.join(","));
}
