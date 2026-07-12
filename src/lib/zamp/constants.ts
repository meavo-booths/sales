/** Fallback Zamp tax code when a product has no Sales-owned taxCode set. */
export const DEFAULT_ZAMP_TAX_CODE = "R_TPP";

export function isUsMarket(market: string): boolean {
  return market.trim().toUpperCase() === "US";
}
