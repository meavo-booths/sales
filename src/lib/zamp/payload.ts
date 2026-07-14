import { DEFAULT_ZAMP_TAX_CODE } from "@/lib/zamp/constants";
import type { ZampAddress, ZampLineItem, ZampTransaction } from "@/lib/zamp/types";

const VALID_TAX_CODE_PREFIX = /^(R_DIG|R_SRV|R_TPP)/i;

export function roundZampMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Zamp accepts ##### or #####-#### (US addresses API). */
export function normalizeZampZip(zip: string): string | null {
  const digits = zip.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  return null;
}

export function sanitizeZampTaxCode(code: string): string {
  const trimmed = code.trim();
  return VALID_TAX_CODE_PREFIX.test(trimmed) ? trimmed : DEFAULT_ZAMP_TAX_CODE;
}

export function zampLineSubtotal(lineItems: ZampLineItem[]): number {
  return roundZampMoney(
    lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0),
  );
}

/** Normalize address, money, and line items to match Zamp's request schema. */
export function prepareZampTransaction(transaction: ZampTransaction): ZampTransaction | string {
  const zip = normalizeZampZip(transaction.shipToAddress.zip);
  if (!zip) {
    return "US ship-to ZIP must be 5 digits (or ZIP+4)";
  }

  const state = transaction.shipToAddress.state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return "US ship-to state must be a 2-letter code (e.g. CA)";
  }

  const lineItems = transaction.lineItems
    .map((item) => ({
      id: item.id,
      amount: roundZampMoney(item.amount),
      quantity: item.quantity,
      discount: 0,
      shippingHandling: 0,
      productName: item.productName,
      ...(item.productSku ? { productSku: item.productSku } : {}),
      productTaxCode: sanitizeZampTaxCode(item.productTaxCode ?? DEFAULT_ZAMP_TAX_CODE),
    }))
    .filter((item) => item.amount > 0 && item.quantity > 0);

  if (lineItems.length === 0) {
    return "Add at least one line item with a price above $0 for sales tax";
  }

  const subtotal = zampLineSubtotal(lineItems);
  const taxCollected = roundZampMoney(transaction.taxCollected ?? 0);

  const shipToAddress: ZampAddress = {
    line1: transaction.shipToAddress.line1.trim(),
    city: transaction.shipToAddress.city.trim(),
    state,
    zip,
  };
  const line2 = transaction.shipToAddress.line2?.trim();
  if (line2) shipToAddress.line2 = line2;

  return {
    ...transaction,
    currency: transaction.currency || "USD",
    subtotal,
    taxCollected,
    total: roundZampMoney(subtotal + taxCollected),
    shipToAddress,
    lineItems,
  };
}
