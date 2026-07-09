"use server";

import { revalidatePath } from "next/cache";
import { BoothUnitStatus, PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { contactInputSchema, convertInputSchema } from "@/lib/quote-input";
import { exportDealToOpsSheet } from "@/lib/ops-sheet-export";
import { syncClientContacts } from "@/lib/client-contacts";
import { fetchExchangeRateToEur, isQuoteCurrency } from "@/lib/exchange-rates";

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

const dealDetailsInputSchema = z.object({
  dealDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  salesRep: z.string().trim().max(200).default(""),
  market: z.string().trim().max(200).default(""),
  usState: z.string().trim().max(100).default(""),
  clientName: z.string().trim().min(1, "Client name is required").max(500),
  clientType: z.enum(["DIRECT", "AGENCY", "COWORKING"]),
  paymentTerms: z.enum(["UPFRONT_100", "SPLIT_50_50", "NET_30"]),
  vatNumber: z.string().trim().max(100).default(""),
  registeredAddress: z.string().trim().max(2000).default(""),
  website: z.string().trim().max(500).default(""),
  socketType: z.string().trim().max(100).default(""),
  targetDeliveryDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .default("")
    .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null)),
});

const dealAssemblyNotesInputSchema = z.object({
  assemblyAddress: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(5000).default(""),
  clientPo: z.string().trim().max(500).default(""),
  actualClient: z.string().trim().max(500).default(""),
});

const dealContactsInputSchema = z.object({
  contacts: z.array(contactInputSchema).min(1, "Add at least one contact").max(20),
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
    .filter((item) => item.product?.kind === "BOOTH")
    .flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        dealId,
        productId: item.productId!,
        finish: item.finish,
        finishDetails: item.finishDetails,
      })),
    );

  const currency = isQuoteCurrency(deal.currency) ? deal.currency : "EUR";
  const exchangeRateToEur = await fetchExchangeRateToEur(currency);

  await prisma.$transaction([
    prisma.deal.update({
      where: { id },
      data: {
        stage: "WON",
        dealId,
        wonAt: new Date(),
        paymentPoDate: paymentPoDate ?? undefined,
        exchangeRateToEur: new Prisma.Decimal(exchangeRateToEur.toFixed(8)),
      },
    }),
    prisma.boothUnit.createMany({ data: boothUnits }),
    ...deal.lineItems.map((lineItem) =>
      prisma.quoteLineItem.update({
        where: { id: lineItem.id },
        data: {
          unitPriceEur: new Prisma.Decimal(
            (Number(lineItem.unitPrice) * exchangeRateToEur).toFixed(2),
          ),
        },
      }),
    ),
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

/**
 * Edit the snapshot details of a won deal. Line items, booth units, and the
 * quote number stay locked; edits never re-sync the Ops File (its rows were
 * written at conversion time).
 */
export async function updateDealDetailsAction(
  id: string,
  rawInput: unknown,
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = dealDetailsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid deal details" };
  }
  const input = parsed.data;

  const deal = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals can be edited here" };

  await prisma.deal.update({
    where: { id },
    data: {
      dealDate: input.dealDate,
      salesRep: input.salesRep,
      market: input.market,
      usState: input.usState,
      clientName: input.clientName,
      clientType: input.clientType,
      paymentTerms: input.paymentTerms,
      vatNumber: input.vatNumber,
      registeredAddress: input.registeredAddress,
      website: input.website,
      socketType: input.socketType,
      targetDeliveryDate: input.targetDeliveryDate,
    },
  });

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}

export async function updateDealAssemblyAndNotesAction(
  id: string,
  rawInput: unknown,
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = dealAssemblyNotesInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const deal = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") {
    return { ok: false, error: "Only won deals can be edited here" };
  }

  await prisma.deal.update({
    where: { id },
    data: {
      assemblyAddress: input.assemblyAddress,
      notes: input.notes,
      clientPo: input.clientPo,
      actualClient: input.actualClient,
    },
  });

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}

/**
 * Toggle the "ready to assemble" flag. Ready deals show up on the assembly
 * app's Ready deals page where the team schedules assemblies for them.
 */
export async function updateDealReadyAction(
  id: string,
  ready: boolean,
): Promise<DealActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") {
    return { ok: false, error: "Only won deals can be marked ready to assemble" };
  }

  await prisma.deal.update({ where: { id }, data: { readyToAssemble: ready === true } });

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { ok: true, id };
}

/** Replace all contacts on a won deal. */
export async function updateDealContactsAction(
  id: string,
  rawInput: unknown,
): Promise<DealActionResult> {
  await requireSalesAccess();

  const parsed = dealContactsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid contacts" };
  }
  const { contacts } = parsed.data;

  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { stage: true, clientId: true },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals can be edited here" };

  await prisma.$transaction(async (tx) => {
    await tx.dealContact.deleteMany({ where: { dealId: id } });
    await tx.dealContact.createMany({
      data: contacts.map((contact, index) => ({
        dealId: id,
        kind: contact.kind,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        sortOrder: index,
      })),
    });
    if (deal.clientId) await syncClientContacts(tx, deal.clientId, contacts);
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
