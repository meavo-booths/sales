import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuoteInput } from "@/lib/quote-input";
import { dealSubtotal } from "@/lib/vat";
import { zampCalculate } from "@/lib/zamp/client";
import { DEFAULT_ZAMP_TAX_CODE, isUsMarket } from "@/lib/zamp/constants";
import { prepareZampTransaction, roundZampMoney, sanitizeZampTaxCode } from "@/lib/zamp/payload";
import type { UsTaxDetail, ZampAddress, ZampLineItem, ZampTransaction } from "@/lib/zamp/types";

type LineForZamp = {
  id?: string;
  quantity: number;
  unitPrice: number | string | { toString(): string };
  customName?: string | null;
  product?: {
    name?: string;
    version?: string;
    xeroItemCode?: string | null;
    taxCode?: string | null;
  } | null;
};

type DealForZampCalc = {
  id?: string;
  quoteNumber?: string;
  dealId?: string | null;
  dealDate?: Date;
  currency: string;
  market: string;
  usState: string;
  shipToLine1: string;
  shipToLine2: string;
  shipToCity: string;
  shipToZip: string;
  lineItems: LineForZamp[];
};

export type ZampCalcOutcome =
  | { ok: true; taxDue: number; detail: UsTaxDetail }
  | { ok: false; error: string };

function lineDescription(item: LineForZamp): string {
  const name = item.product?.name ?? item.customName ?? "Item";
  const version = item.product?.version?.trim();
  return version ? `${name} ${version}` : name;
}

function taxCodeForLine(item: LineForZamp): string {
  const code = item.product?.taxCode?.trim();
  return sanitizeZampTaxCode(code || DEFAULT_ZAMP_TAX_CODE);
}

export function shipToAddressFromDeal(deal: DealForZampCalc): ZampAddress | null {
  const line1 = deal.shipToLine1.trim();
  const city = deal.shipToCity.trim();
  const state = deal.usState.trim().toUpperCase();
  const zip = deal.shipToZip.trim();
  if (!line1 || !city || !state || !zip) return null;

  return {
    line1,
    line2: deal.shipToLine2.trim() || null,
    city,
    state,
    zip,
  };
}

export function buildZampLineItems(
  lineItems: LineForZamp[],
  idPrefix: string,
): ZampLineItem[] {
  return lineItems.map((item, index) => ({
    id: item.id ?? `${idPrefix}-li-${index + 1}`,
    amount: roundZampMoney(Number(item.unitPrice)),
    quantity: item.quantity,
    productName: lineDescription(item),
    productSku: item.product?.xeroItemCode ?? undefined,
    productTaxCode: taxCodeForLine(item),
  }));
}

export function buildZampTransaction(
  deal: DealForZampCalc,
  options?: { transactionId?: string; forCommit?: boolean },
): ZampTransaction | null {
  if (!isUsMarket(deal.market)) return null;

  const shipToAddress = shipToAddressFromDeal(deal);
  if (!shipToAddress) return null;

  const idPrefix = options?.transactionId ?? deal.id ?? deal.quoteNumber ?? "estimate";
  const zampLineItems = buildZampLineItems(deal.lineItems, idPrefix);
  if (zampLineItems.length === 0) return null;

  const transactedAt = (deal.dealDate ?? new Date()).toISOString();
  const transactionId =
    options?.forCommit && deal.dealId
      ? deal.dealId
      : (options?.transactionId ?? `estimate-${idPrefix}`);

  return {
    id: transactionId,
    name: deal.quoteNumber ?? deal.dealId ?? transactionId,
    transactedAt,
    currency: deal.currency || "USD",
    subtotal: roundZampMoney(dealSubtotal(deal)),
    taxCollected: 0,
    total: roundZampMoney(dealSubtotal(deal)),
    shipToAddress,
    lineItems: zampLineItems,
    metadata: {
      source: "meavo-sales",
      ...(deal.id ? { dealDbId: deal.id } : {}),
    },
  };
}

/** Call Zamp /calculations for a US deal or quote draft. Returns null when not applicable. */
export async function calculateUsTaxForDeal(deal: DealForZampCalc): Promise<ZampCalcOutcome | null> {
  if (!isUsMarket(deal.market)) return null;

  const draft = buildZampTransaction(deal, {
    transactionId: deal.id ? `quote-${deal.id}` : undefined,
  });
  if (!draft) {
    return {
      ok: false,
      error: "US ship-to address (line 1, city, state, and ZIP) is required for sales tax",
    };
  }

  const prepared = prepareZampTransaction(draft);
  if (typeof prepared === "string") {
    return { ok: false, error: prepared };
  }

  try {
    const result = await zampCalculate(prepared);
    const detail: UsTaxDetail = {
      taxDue: result.taxDue,
      taxes: result.taxes,
      calculatedAt: new Date().toISOString(),
    };
    return { ok: true, taxDue: result.taxDue, detail };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Zamp tax calculation failed",
    };
  }
}

export function usTaxAmountDecimal(taxDue: number): Prisma.Decimal {
  return new Prisma.Decimal(taxDue.toFixed(2));
}

export function usTaxDetailJson(detail: UsTaxDetail): Prisma.InputJsonValue {
  return detail as unknown as Prisma.InputJsonValue;
}

/** Read persisted usTaxAmount from a deal row (defaults to 0). */
export function persistedUsTaxAmount(deal: { usTaxAmount?: unknown }): number {
  if (deal.usTaxAmount == null) return 0;
  const value = Number(deal.usTaxAmount);
  return Number.isFinite(value) ? value : 0;
}

type ProductTaxMeta = {
  name: string;
  version: string;
  xeroItemCode: string | null;
  taxCode: string;
};

/** Flatten nested quote input into Zamp line items (with product tax metadata). */
export function flattenQuoteInputLines(
  input: QuoteInput,
  productsById: Map<string, ProductTaxMeta>,
): LineForZamp[] {
  const productLine = (productId: string, quantity: number, unitPrice: number, customName?: string) => {
    const product = productsById.get(productId);
    return {
      quantity,
      unitPrice,
      customName,
      product: product
        ? {
            name: product.name,
            version: product.version,
            xeroItemCode: product.xeroItemCode,
            taxCode: product.taxCode,
          }
        : null,
    };
  };

  const lines: LineForZamp[] = [];
  for (const item of input.lineItems) {
    lines.push(productLine(item.productId, item.quantity, item.unitPrice));
    for (const addOn of item.addOns) {
      lines.push(productLine(addOn.productId, addOn.quantity, addOn.unitPrice));
    }
  }
  for (const addOn of input.standaloneAddOns) {
    lines.push(productLine(addOn.productId, addOn.quantity, addOn.unitPrice));
  }
  for (const custom of input.customLines) {
    lines.push({
      quantity: custom.quantity,
      unitPrice: custom.unitPrice,
      customName: custom.name,
      product: null,
    });
  }
  return lines;
}

export function dealForZampFromQuoteInput(
  input: QuoteInput,
  productsById: Map<string, ProductTaxMeta>,
  options?: { id?: string; quoteNumber?: string; dealId?: string | null; dealDate?: Date },
): DealForZampCalc {
  return {
    id: options?.id,
    quoteNumber: options?.quoteNumber,
    dealId: options?.dealId,
    dealDate: options?.dealDate ?? input.dealDate,
    currency: input.currency,
    market: input.market,
    usState: input.usState,
    shipToLine1: input.shipToLine1,
    shipToLine2: input.shipToLine2,
    shipToCity: input.shipToCity,
    shipToZip: input.shipToZip,
    lineItems: flattenQuoteInputLines(input, productsById),
  };
}

export async function loadProductTaxMeta(
  productIds: string[],
): Promise<Map<string, ProductTaxMeta>> {
  if (productIds.length === 0) return new Map();

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, version: true, xeroItemCode: true, taxCode: true },
  });

  return new Map(
    products.map((product) => [
      product.id,
      {
        name: product.name,
        version: product.version,
        xeroItemCode: product.xeroItemCode,
        taxCode: product.taxCode,
      },
    ]),
  );
}

function collectProductIds(input: QuoteInput): string[] {
  return [
    ...new Set([
      ...input.lineItems.map((item) => item.productId),
      ...input.lineItems.flatMap((item) => item.addOns.map((addOn) => addOn.productId)),
      ...input.standaloneAddOns.map((addOn) => addOn.productId),
    ]),
  ];
}

export async function resolveUsTaxForQuoteInput(
  input: QuoteInput,
  options?: { id?: string; quoteNumber?: string },
): Promise<{
  usTaxAmount: Prisma.Decimal;
  usTaxDetail: Prisma.InputJsonValue | null;
}> {
  if (!isUsMarket(input.market)) {
    return { usTaxAmount: new Prisma.Decimal(0), usTaxDetail: null };
  }

  const productsById = await loadProductTaxMeta(collectProductIds(input));
  const dealForZamp = dealForZampFromQuoteInput(input, productsById, options);
  const outcome = await calculateUsTaxForDeal(dealForZamp);

  if (!outcome) {
    return { usTaxAmount: new Prisma.Decimal(0), usTaxDetail: null };
  }

  if (!outcome.ok) {
    const detail: UsTaxDetail = {
      taxDue: 0,
      taxes: [],
      calculatedAt: new Date().toISOString(),
      error: outcome.error,
    };
    return {
      usTaxAmount: new Prisma.Decimal(0),
      usTaxDetail: usTaxDetailJson(detail),
    };
  }

  return {
    usTaxAmount: usTaxAmountDecimal(outcome.taxDue),
    usTaxDetail: usTaxDetailJson(outcome.detail),
  };
}
