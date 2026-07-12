/**
 * Market-based VAT rates for quotes and deals (UK, Germany).
 *
 * US sales tax is computed via Zamp and persisted on the Deal (`usTaxAmount`).
 * Line item prices are always stored and displayed excl. tax; tax is added
 * on top at display/invoice time.
 */
export const MARKET_VAT_RATES: Record<string, number> = {
  UK: 0.2,
  Germany: 0.19,
};

export function vatRateForMarket(market: string): number {
  return MARKET_VAT_RATES[market] ?? 0;
}

export function taxLabelForMarket(market: string): "VAT" | "Sales tax" {
  return market.trim().toUpperCase() === "US" ? "Sales tax" : "VAT";
}

export type DealTotalsOptions = {
  /** Persisted Zamp sales tax for US deals. */
  salesTaxAmount?: number;
};

export type DealTotals = {
  /** Sum of line items, excl. tax. */
  subtotal: number;
  /** e.g. 0.2 for UK. 0 for US (uses salesTaxAmount instead). */
  vatRate: number;
  vatAmount: number;
  totalInclVat: number;
  taxLabel: "VAT" | "Sales tax";
  hasTax: boolean;
};

export function dealTotals(
  subtotal: number,
  market: string,
  options?: DealTotalsOptions,
): DealTotals {
  const taxLabel = taxLabelForMarket(market);
  const isUs = market.trim().toUpperCase() === "US";

  if (isUs) {
    const salesTax = Math.max(0, options?.salesTaxAmount ?? 0);
    const vatAmount = Math.round(salesTax * 100) / 100;
    return {
      subtotal,
      vatRate: 0,
      vatAmount,
      totalInclVat: subtotal + vatAmount,
      taxLabel,
      hasTax: vatAmount > 0,
    };
  }

  const vatRate = vatRateForMarket(market);
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  return {
    subtotal,
    vatRate,
    vatAmount,
    totalInclVat: subtotal + vatAmount,
    taxLabel,
    hasTax: vatRate > 0,
  };
}

/** Sum of line items in the quote currency, excl. VAT — the single subtotal implementation. */
export function dealSubtotal(deal: {
  lineItems: { quantity: number; unitPrice: { toString(): string } | number | string }[];
}): number {
  return deal.lineItems.reduce((sum, li) => sum + li.quantity * Number(li.unitPrice), 0);
}

export function formatVatRate(rate: number): string {
  return `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 1)}%`;
}

export function formatTaxLineLabel(market: string, vatRate: number): string {
  const label = taxLabelForMarket(market);
  if (market.trim().toUpperCase() === "US") return label;
  return `${label} (${formatVatRate(vatRate)})`;
}
