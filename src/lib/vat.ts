/**
 * Market-based VAT rates for quotes and deals.
 *
 * Line item prices are always stored and displayed excl. VAT; VAT is computed
 * on the subtotal at display/invoice time from the deal's market. Extend by
 * adding entries here — no schema change needed.
 */
export const MARKET_VAT_RATES: Record<string, number> = {
  UK: 0.2,
  Germany: 0.19,
};

export function vatRateForMarket(market: string): number {
  return MARKET_VAT_RATES[market] ?? 0;
}

export type DealTotals = {
  /** Sum of line items, excl. VAT. */
  subtotal: number;
  /** e.g. 0.2 for UK. 0 when the market has no VAT rule. */
  vatRate: number;
  vatAmount: number;
  totalInclVat: number;
};

export function dealTotals(subtotal: number, market: string): DealTotals {
  const vatRate = vatRateForMarket(market);
  // Round VAT to cents so displayed rows always add up.
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  return { subtotal, vatRate, vatAmount, totalInclVat: subtotal + vatAmount };
}

export function formatVatRate(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
}
