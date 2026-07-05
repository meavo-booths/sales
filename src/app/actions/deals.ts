"use server";

import { revalidatePath } from "next/cache";
import { BoothUnitStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { convertInputSchema } from "@/lib/quote-input";
import { exportDealToOpsSheet } from "@/lib/ops-sheet-export";

const paymentInputSchema = z.object({
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentPoDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  notes: z.string().max(5000).optional(),
});

const boothUnitInputSchema = z.object({
  status: z.nativeEnum(BoothUnitStatus),
  location: z.string().max(500),
});

export type DealActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type DealIdCheck = {
  available: boolean;
  conflictQuoteNumber?: string;
  assemblyExists: boolean;
};

/** Live check while the rep types the DealID in the conversion dialog. */
export async function checkDealIdAction(rawDealId: string): Promise<DealIdCheck> {
  await requireSalesAccess();

  const dealId = rawDealId.trim();
  if (!dealId) return { available: false, assemblyExists: false };

  const [conflict, assembly] = await Promise.all([
    prisma.deal.findUnique({ where: { dealId }, select: { quoteNumber: true } }),
    prisma.assembly.findUnique({ where: { dealId }, select: { id: true } }),
  ]);

  return {
    available: !conflict,
    conflictQuoteNumber: conflict?.quoteNumber,
    assemblyExists: Boolean(assembly),
  };
}

/**
 * The FUCK YEAH button. Marks the quote as won under the rep-entered DealID
 * and spawns one BoothUnit per booth (status PLANNED) for manufacturing.
 * Add-on line items never become booth units.
 * Afterwards the deal is appended to the Ops File (non-blocking).
 */
export async function convertQuoteAction(
  id: string,
  rawInput: unknown,
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = convertInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Enter a valid DealID" };
  const { dealId, paymentPoDate } = parsed.data;

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { lineItems: { include: { product: { select: { kind: true } } } } },
  });
  if (!deal) return { ok: false, error: "Quote not found" };
  if (deal.stage !== "QUOTE") return { ok: false, error: "This quote was already converted" };
  if (deal.lineItems.length === 0) {
    return { ok: false, error: "Add at least one line item before converting" };
  }

  const conflict = await prisma.deal.findUnique({ where: { dealId } });
  if (conflict) {
    return { ok: false, error: `DealID ${dealId} is already used by ${conflict.quoteNumber}` };
  }

  const boothUnits = deal.lineItems
    .filter((item) => item.product.kind === "BOOTH")
    .flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        dealId,
        productId: item.productId,
        finish: item.finish,
        finishDetails: item.finishDetails,
      })),
    );

  await prisma.$transaction([
    prisma.deal.update({
      where: { id },
      data: {
        stage: "WON",
        dealId,
        wonAt: new Date(),
        paymentPoDate: paymentPoDate ?? undefined,
      },
    }),
    prisma.boothUnit.createMany({ data: boothUnits }),
  ]);

  // Append to the Ops File; failures are recorded on the deal, never thrown.
  await exportDealToOpsSheet(id);

  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath(`/quotes/${id}`);
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}

export async function markQuoteLostAction(id: string): Promise<DealActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!deal) return { ok: false, error: "Quote not found" };
  if (deal.stage !== "QUOTE") return { ok: false, error: "Only open quotes can be marked lost" };

  await prisma.deal.update({ where: { id }, data: { stage: "LOST" } });
  revalidatePath("/");
  revalidatePath(`/quotes/${id}`);
  return { ok: true, id };
}

export async function updatePaymentAction(
  id: string,
  rawInput: { paymentStatus: PaymentStatus; paymentPoDate?: string | null; notes?: string },
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = paymentInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Invalid payment details" };
  const input = parsed.data;

  const deal = await prisma.deal.findUnique({ where: { id }, select: { id: true } });
  if (!deal) return { ok: false, error: "Deal not found" };

  const paymentPoDate =
    input.paymentPoDate === undefined
      ? undefined
      : input.paymentPoDate
        ? new Date(`${input.paymentPoDate}T00:00:00.000Z`)
        : null;

  await prisma.deal.update({
    where: { id },
    data: {
      paymentStatus: input.paymentStatus,
      paymentPoDate,
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    },
  });

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}

export async function updateBoothUnitAction(
  unitId: string,
  rawInput: { status: BoothUnitStatus; location: string },
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = boothUnitInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Invalid booth unit details" };
  const input = parsed.data;

  const unit = await prisma.boothUnit.update({
    where: { id: unitId },
    data: { status: input.status, location: input.location.trim() },
    select: { id: true, deal: { select: { id: true } } },
  });

  revalidatePath(`/deals/${unit.deal.id}`);
  return { ok: true, id: unit.id };
}

/** Retry the Ops File write-back after a failed sync. */
export async function retryOpsSheetSyncAction(id: string): Promise<DealActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { stage: true, sheetSyncedAt: true },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals sync to the Ops File" };
  if (deal.sheetSyncedAt) return { ok: false, error: "This deal is already synced" };

  await exportDealToOpsSheet(id);
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}
