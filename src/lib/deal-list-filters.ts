import type { DealClientType, PaymentStatus, Prisma } from "@prisma/client";
import { SOCKET_TYPE_OPTIONS } from "@/lib/deal-values";

const CLIENT_TYPES: DealClientType[] = ["DIRECT", "AGENCY", "COWORKING"];
const PAYMENT_STATUSES: PaymentStatus[] = ["UNPAID", "PARTIALLY_PAID", "PAID"];

export type DealListSort = "date_desc" | "date_asc";

export type DealListFilterState = {
  search: string;
  sort: DealListSort;
  clientTypes: DealClientType[];
  markets: string[];
  salesReps: string[];
  paymentStatuses: PaymentStatus[];
  socketTypes: string[];
};

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

export function parseDealFilterValues(
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
  return parseDealFilterValues(raw).filter((value): value is DealClientType =>
    CLIENT_TYPES.includes(value as DealClientType),
  );
}

export function parseMarketFilters(raw: string | string[] | undefined): string[] {
  return parseDealFilterValues(raw);
}

export function parseSalesRepFilters(raw: string | string[] | undefined): string[] {
  return parseDealFilterValues(raw);
}

export function parseSocketTypeFilters(raw: string | string[] | undefined): string[] {
  return parseDealFilterValues(raw);
}

export function parsePaymentStatusFilters(
  raw: string | string[] | undefined,
): PaymentStatus[] {
  return parseDealFilterValues(raw).filter((value): value is PaymentStatus =>
    PAYMENT_STATUSES.includes(value as PaymentStatus),
  );
}

export function parseDealSort(raw: string | undefined): DealListSort {
  return raw === "date_asc" ? "date_asc" : "date_desc";
}

export function buildDealSearchWhere(search: string): Prisma.DealWhereInput | null {
  const q = search.trim();
  if (!q) return null;

  return {
    OR: [
      { quoteNumber: { contains: q, mode: "insensitive" } },
      { dealId: { contains: q, mode: "insensitive" } },
      { clientName: { contains: q, mode: "insensitive" } },
      { actualClient: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { assemblyAddress: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ],
  };
}

export function buildDealAdvancedWhere(
  filters: Pick<
    DealListFilterState,
    "clientTypes" | "markets" | "salesReps" | "paymentStatuses" | "socketTypes"
  >,
): Prisma.DealWhereInput {
  const and: Prisma.DealWhereInput[] = [];

  if (filters.clientTypes.length > 0) {
    and.push({ clientType: { in: filters.clientTypes } });
  }
  if (filters.markets.length > 0) {
    and.push({ market: { in: filters.markets } });
  }
  if (filters.salesReps.length > 0) {
    and.push({ salesRep: { in: filters.salesReps } });
  }
  if (filters.paymentStatuses.length > 0) {
    and.push({ paymentStatus: { in: filters.paymentStatuses } });
  }
  if (filters.socketTypes.length > 0) {
    and.push({ socketType: { in: filters.socketTypes } });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildDealListWhere(
  base: Prisma.DealWhereInput,
  filters: DealListFilterState,
): Prisma.DealWhereInput {
  const and: Prisma.DealWhereInput[] = [base];
  const searchWhere = buildDealSearchWhere(filters.search);
  if (searchWhere) and.push(searchWhere);
  const advancedWhere = buildDealAdvancedWhere(filters);
  if (Object.keys(advancedWhere).length > 0) and.push(advancedWhere);
  return { AND: and };
}

export function hasDealAdvancedFilters(
  filters: Pick<
    DealListFilterState,
    "clientTypes" | "markets" | "salesReps" | "paymentStatuses" | "socketTypes"
  >,
): boolean {
  return (
    filters.clientTypes.length > 0 ||
    filters.markets.length > 0 ||
    filters.salesReps.length > 0 ||
    filters.paymentStatuses.length > 0 ||
    filters.socketTypes.length > 0
  );
}

export function hasDealListFilters(filters: DealListFilterState): boolean {
  return filters.search.trim().length > 0 || hasDealAdvancedFilters(filters);
}

export type DealListUrlState = DealListFilterState & {
  scope: "mine" | "all";
  quotesFilter?: string;
  dealsPaymentPill?: string;
  page?: number;
};

export function appendDealListParams(
  params: URLSearchParams,
  state: DealListUrlState,
  variant: "quotes" | "deals",
): void {
  if (state.scope === "all") params.set("scope", "all");

  if (variant === "quotes") {
    if (state.quotesFilter && state.quotesFilter !== "open") {
      params.set("filter", state.quotesFilter);
    }
    if (state.paymentStatuses.length > 0) {
      params.set("payment", state.paymentStatuses.join(","));
    }
  } else if (state.dealsPaymentPill && state.dealsPaymentPill !== "all") {
    params.set("payment", state.dealsPaymentPill);
  }

  if (state.search.trim()) params.set("q", state.search.trim());
  if (state.sort === "date_asc") params.set("sort", "date_asc");
  if (state.clientTypes.length > 0) params.set("type", state.clientTypes.join(","));
  if (state.markets.length > 0) params.set("market", state.markets.join(","));
  if (state.salesReps.length > 0) params.set("salesRep", state.salesReps.join(","));
  if (state.socketTypes.length > 0) params.set("socket", state.socketTypes.join(","));
  if (state.page && state.page > 1) params.set("page", String(state.page));
}

export function buildDealListHref(
  basePath: string,
  state: DealListUrlState,
  variant: "quotes" | "deals",
): string {
  const params = new URLSearchParams();
  appendDealListParams(params, state, variant);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function mergeSocketTypeOptions(legacyValues: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of [...SOCKET_TYPE_OPTIONS, ...legacyValues]) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.localeCompare(b));
}
