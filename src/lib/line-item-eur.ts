type LineItemPriceFields = {
  quantity: number;
  unitPrice: { toString(): string } | number | string;
  unitPriceEur?: { toString(): string } | number | string | null;
};

/**
 * EUR unit price for reporting. Legacy rows without a stored EUR price can
 * only fall back to unitPrice when the deal is in EUR — for any other
 * currency the EUR value is unknown and null is returned, so callers show
 * "unknown" instead of a plausible-looking wrong number.
 */
export function lineItemUnitPriceEur(
  item: LineItemPriceFields,
  dealCurrency: string,
): number | null {
  if (item.unitPriceEur != null) {
    const eur = Number(item.unitPriceEur);
    if (Number.isFinite(eur)) return eur;
  }
  return dealCurrency === "EUR" ? Number(item.unitPrice) : null;
}

export function lineItemAmountEur(
  item: LineItemPriceFields,
  dealCurrency: string,
): number | null {
  const unitPriceEur = lineItemUnitPriceEur(item, dealCurrency);
  return unitPriceEur == null ? null : item.quantity * unitPriceEur;
}

/** Null when any line item's EUR amount is unknown. */
export function dealTotalEur(deal: {
  currency: string;
  lineItems: LineItemPriceFields[];
}): number | null {
  let total = 0;
  for (const item of deal.lineItems) {
    const amount = lineItemAmountEur(item, deal.currency);
    if (amount == null) return null;
    total += amount;
  }
  return total;
}
