/** Zamp API request/response shapes — see https://developer.zamp.com */

export type ZampAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

export type ZampLineItem = {
  id: string;
  amount: number;
  quantity: number;
  discount?: number;
  shipping?: number;
  handling?: number;
  shippingHandling?: number;
  productName?: string;
  productSku?: string;
  productTaxCode?: string;
};

export type ZampTransaction = {
  id: string;
  name?: string;
  parentId?: string | null;
  transactedAt: string;
  recalculate?: boolean;
  currency?: string;
  discount?: number;
  subtotal: number;
  shipping?: number;
  handling?: number;
  shippingHandling?: number;
  taxCollected?: number;
  total: number;
  shipFromAddress?: ZampAddress | null;
  shipToAddress: ZampAddress;
  lineItems: ZampLineItem[];
  metadata?: Record<string, string>;
};

export type ZampTaxBreakdown = {
  lineItemId?: string;
  state?: string;
  sourcing?: string;
  jurisdictionCode?: string;
  jurisdictionName?: string;
  jurisdictionDivision?: string;
  compositeCode?: string;
  compositeName?: string;
  exceptionCode?: string;
  taxableAmount?: number;
  nontaxableAmount?: number;
  excludedAmount?: number;
  taxRate?: number;
  taxDue?: number;
  taxCollected?: number;
};

export type ZampCalcResult = ZampTransaction & {
  taxDue: number;
  taxes: ZampTaxBreakdown[];
};

/** Persisted on Deal.usTaxDetail after a successful calculation. */
export type UsTaxDetail = {
  taxDue: number;
  taxes: ZampTaxBreakdown[];
  calculatedAt: string;
  error?: string;
};
