import { prisma } from "@/lib/prisma";
import { isZampConfigured, zampCreateTransaction } from "@/lib/zamp/client";
import { buildZampTransaction } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";
import { prepareZampTransaction, roundZampMoney } from "@/lib/zamp/payload";
import type { UsTaxDetail } from "@/lib/zamp/types";

/**
 * Commit a won US deal to Zamp for filing and nexus monitoring. Records the
 * transaction id or error on the Deal; never throws.
 */
export async function exportDealToZamp(dealDbId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    include: {
      lineItems: { include: { product: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!deal || deal.stage !== "WON" || !deal.dealId) return;
  if (!isUsMarket(deal.market)) return;
  if (deal.zampTransactionId) return;

  const fail = async (message: string) => {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { zampSyncError: message },
    });
  };

  if (!isZampConfigured()) return;

  const draft = buildZampTransaction(deal, { forCommit: true });
  if (!draft) {
    await fail(
      "US ship-to address (line 1, city, state, ZIP) is missing — edit the deal before retrying",
    );
    return;
  }

  const prepared = prepareZampTransaction(draft);
  if (typeof prepared === "string") {
    await fail(prepared);
    return;
  }

  const taxDue = Number(deal.usTaxAmount);
  prepared.taxCollected = roundZampMoney(Number.isFinite(taxDue) ? taxDue : 0);
  prepared.total = roundZampMoney(prepared.subtotal + prepared.taxCollected);

  try {
    const result = await zampCreateTransaction(prepared);
    const detail: UsTaxDetail = {
      taxDue: result.taxDue,
      taxes: result.taxes,
      calculatedAt: new Date().toISOString(),
    };

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        zampTransactionId: result.id,
        zampSyncedAt: new Date(),
        zampSyncError: null,
        usTaxAmount: result.taxDue.toFixed(2),
        usTaxDetail: detail as object,
      },
    });
  } catch (error) {
    console.error(`Zamp transaction sync failed for deal ${deal.dealId}:`, error);
    await fail(error instanceof Error ? error.message : "Zamp transaction sync failed");
  }
}
