import type { QuoteCurrency } from "@/lib/exchange-rates";

/** Default quote currency for a sales market (case-insensitive). */
export function currencyForMarket(market: string): QuoteCurrency {
  const normalized = market.trim().toUpperCase();
  if (normalized === "UK") return "GBP";
  if (normalized === "US") return "USD";
  if (normalized === "CZ-SK") return "CZK";
  return "EUR";
}
