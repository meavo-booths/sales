import { formatMoney } from "@/lib/deal-values";

export type LineItemDiscountType = "NONE" | "FIXED" | "PERCENT";

export type LineItemWithDiscount = {
  quantity: number;
  unitPrice: number | string | { toString(): string };
  discountType?: string | null;
  discountValue?: number | string | { toString(): string } | null;
};

export function parseDiscountType(value: unknown): LineItemDiscountType {
  if (value === "FIXED" || value === "PERCENT") return value;
  return "NONE";
}

export function parseDiscountValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function effectiveUnitPrice(
  unitPrice: number,
  discountType: LineItemDiscountType,
  discountValue: number,
): number {
  if (discountType === "FIXED") {
    return Math.max(0, unitPrice - discountValue);
  }
  if (discountType === "PERCENT") {
    return Math.max(0, unitPrice * (1 - discountValue / 100));
  }
  return unitPrice;
}

export function lineExtendedTotal(
  quantity: number,
  unitPrice: number,
  discountType: LineItemDiscountType,
  discountValue: number,
): number {
  return quantity * effectiveUnitPrice(unitPrice, discountType, discountValue);
}

export function lineItemEffectiveUnitPrice(item: LineItemWithDiscount): number {
  return effectiveUnitPrice(
    Number(item.unitPrice),
    parseDiscountType(item.discountType),
    parseDiscountValue(item.discountValue),
  );
}

export function lineItemExtendedTotal(item: LineItemWithDiscount): number {
  return item.quantity * lineItemEffectiveUnitPrice(item);
}

export function formatDiscountLabel(
  discountType: LineItemDiscountType,
  discountValue: number,
  currency: string,
): string | null {
  if (discountType === "NONE" || discountValue <= 0) return null;
  if (discountType === "PERCENT") return `${discountValue}% off`;
  return `${formatMoney(discountValue, currency)} off/unit`;
}

export type XeroLineMapping = {
  UnitAmount: number;
  DiscountRate?: number;
  descriptionSuffix?: string;
};

/** Map a quote line to Xero invoice fields (list price + native discount when possible). */
export function xeroLineFromQuoteItem(
  item: Pick<LineItemWithDiscount, "unitPrice" | "discountType" | "discountValue">,
  amountFactor: number,
  currency: string,
): XeroLineMapping {
  const listPrice = Number(item.unitPrice);
  const discountType = parseDiscountType(item.discountType);
  const discountValue = parseDiscountValue(item.discountValue);

  if (amountFactor !== 1) {
    const net = effectiveUnitPrice(listPrice, discountType, discountValue);
    return { UnitAmount: net * amountFactor };
  }

  if (discountType === "NONE" || discountValue <= 0) {
    return { UnitAmount: listPrice };
  }

  if (discountType === "PERCENT") {
    return { UnitAmount: listPrice, DiscountRate: discountValue };
  }

  if (listPrice <= 0) {
    return { UnitAmount: listPrice };
  }

  const rate = (discountValue / listPrice) * 100;
  const roundedRate = Math.round(rate * 100) / 100;
  const isRound = Math.abs(rate - roundedRate) < 0.001;
  return {
    UnitAmount: listPrice,
    DiscountRate: roundedRate,
    descriptionSuffix: isRound
      ? undefined
      : `Fixed discount: ${formatMoney(discountValue, currency)}/unit`,
  };
}
