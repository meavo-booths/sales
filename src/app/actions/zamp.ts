"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { quoteInputSchema } from "@/lib/quote-input";
import { isZampConfigured } from "@/lib/zamp/client";
import {
  calculateUsTaxForDeal,
  dealForZampFromQuoteInput,
  loadProductTaxMeta,
} from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";
import { exportDealToZamp } from "@/lib/zamp/export-deal";
import type { UsTaxDetail } from "@/lib/zamp/types";
import { firstZodError } from "@/lib/zod-errors";

export type ZampActionResult = { ok: true } | { ok: false; error: string };

export type UsTaxEstimateResult =
  | { ok: true; taxDue: number; detail: UsTaxDetail }
  | { ok: false; error: string };

function collectProductIds(input: {
  lineItems: { productId: string; addOns: { productId: string }[] }[];
  standaloneAddOns: { productId: string }[];
}): string[] {
  return [
    ...new Set([
      ...input.lineItems.map((item) => item.productId),
      ...input.lineItems.flatMap((item) => item.addOns.map((addOn) => addOn.productId)),
      ...input.standaloneAddOns.map((addOn) => addOn.productId),
    ]),
  ];
}

/** Live US sales tax estimate for the quote form (does not persist). */
export async function calculateUsTaxAction(rawInput: unknown): Promise<UsTaxEstimateResult> {
  await requireSalesAccess();

  if (!isZampConfigured()) {
    return { ok: false, error: "Zamp is not configured (ZAMP_API_KEY missing)" };
  }

  const parsed = quoteInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  if (!isUsMarket(input.market)) {
    return { ok: false, error: "Sales tax estimates apply to US market quotes only" };
  }

  const productsById = await loadProductTaxMeta(collectProductIds(input));
  const dealForZamp = dealForZampFromQuoteInput(input, productsById);
  const outcome = await calculateUsTaxForDeal(dealForZamp);

  if (!outcome) {
    return {
      ok: false,
      error: "US ship-to address (line 1, city, state, ZIP) is required for sales tax",
    };
  }
  if (!outcome.ok) return { ok: false, error: outcome.error };

  return { ok: true, taxDue: outcome.taxDue, detail: outcome.detail };
}

/** Retry committing a won US deal to Zamp after a failed win-time export. */
export async function retryZampSyncAction(dealDbId: string): Promise<ZampActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: { stage: true, market: true, zampTransactionId: true },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals sync to Zamp" };
  if (!isUsMarket(deal.market)) return { ok: false, error: "Only US deals sync to Zamp" };
  if (deal.zampTransactionId) return { ok: false, error: "This deal is already synced to Zamp" };

  await exportDealToZamp(dealDbId);
  revalidatePath(`/deals/${dealDbId}`);

  const updated = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: { zampTransactionId: true, zampSyncError: true },
  });
  if (!updated?.zampTransactionId) {
    return { ok: false, error: updated?.zampSyncError ?? "Zamp sync failed" };
  }
  return { ok: true };
}
