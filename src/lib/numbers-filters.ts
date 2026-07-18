import type { DealClientType } from "@prisma/client";
import {
  parseClientTypeFilters,
  parseMarketFilters,
  parseSalesRepFilters,
} from "@/lib/deal-list-filters";

export type NumbersFilters = {
  clientTypes: DealClientType[];
  markets: string[];
  salesReps: string[];
};

export type NumbersBucket = {
  key: string;
  label: string;
  count: number;
  totalEur: number;
};

export type NumbersMonthPoint = {
  month: number; // 1–12
  label: string;
  conversionPct: number | null;
  avgDaysToWin: number | null;
  quoteCount: number;
  wonCount: number;
  winsInMonth: number;
};

export function parseNumbersFilters(params: {
  type?: string | string[];
  market?: string | string[];
  salesRep?: string | string[];
}): NumbersFilters {
  return {
    clientTypes: parseClientTypeFilters(params.type),
    markets: parseMarketFilters(params.market),
    salesReps: parseSalesRepFilters(params.salesRep),
  };
}

export function appendNumbersFilterParams(
  params: URLSearchParams,
  filters: NumbersFilters,
): void {
  if (filters.clientTypes.length > 0) {
    params.set("type", filters.clientTypes.join(","));
  }
  if (filters.markets.length > 0) {
    params.set("market", filters.markets.join(","));
  }
  if (filters.salesReps.length > 0) {
    params.set("salesRep", filters.salesReps.join(","));
  }
}

export function hasNumbersFilters(filters: NumbersFilters): boolean {
  return (
    filters.clientTypes.length > 0 ||
    filters.markets.length > 0 ||
    filters.salesReps.length > 0
  );
}
