type LineItemPriceFields = {
  quantity: number;
  unitPrice: { toString(): string } | number | string;
  unitPriceEur?: { toString(): string } | number | string | null;
};

/** EUR unit price for reporting; falls back to unitPrice on legacy rows. */
export function lineItemUnitPriceEur(item: LineItemPriceFields): number {
  if (item.unitPriceEur != null) {
    const eur = Number(item.unitPriceEur);
    if (Number.isFinite(eur)) return eur;
  }
  return Number(item.unitPrice);
}

export function lineItemAmountEur(item: LineItemPriceFields): number {
  return item.quantity * lineItemUnitPriceEur(item);
}

export function dealTotalEur(deal: { lineItems: LineItemPriceFields[] }): number {
  return deal.lineItems.reduce((sum, li) => sum + lineItemAmountEur(li), 0);
}
