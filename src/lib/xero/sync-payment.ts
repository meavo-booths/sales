import type { PaymentStatus, PaymentTerms } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isXeroConfigured } from "@/lib/xero/client";
import { getInvoice, type XeroInvoicePayment } from "@/lib/xero/resources";
import {
  formatPaymentBreakdownLine,
  type XeroInvoicePaymentState,
  type XeroPaymentBreakdown,
} from "@/lib/xero/payment-format";

// Re-exported so existing server-side importers keep their import path.
export {
  formatPaymentBreakdownLine,
  type XeroInvoicePaymentState,
  type XeroPaymentBreakdown,
};

export function invoiceFullyPaid(invoice: XeroInvoicePayment): boolean {
  if (invoice.Status === "VOIDED") return false;
  const paid = invoice.AmountPaid ?? 0;
  const due = invoice.AmountDue ?? 0;
  return invoice.Status === "PAID" || (paid > 0 && due === 0);
}

export function invoicePartiallyPaid(invoice: XeroInvoicePayment): boolean {
  if (invoice.Status === "VOIDED") return false;
  const paid = invoice.AmountPaid ?? 0;
  const due = invoice.AmountDue ?? 0;
  return paid > 0 && due > 0;
}

export function invoicePaymentState(
  invoice: XeroInvoicePayment | null | undefined,
): XeroInvoicePaymentState {
  if (!invoice || invoice.Status === "VOIDED") return "unpaid";
  if (invoiceFullyPaid(invoice)) return "paid";
  if (invoicePartiallyPaid(invoice)) return "partial";
  return "unpaid";
}

export function derivePaymentStatus(input: {
  paymentTerms: PaymentTerms;
  primary: XeroInvoicePayment;
  final?: XeroInvoicePayment | null;
  hasFinalInvoice: boolean;
}): PaymentStatus {
  const { paymentTerms, primary, final: finalInvoice, hasFinalInvoice } = input;

  if (paymentTerms === "SPLIT_50_50") {
    if (!hasFinalInvoice) {
      if (invoicePartiallyPaid(primary)) return "PARTIALLY_PAID";
      if (invoiceFullyPaid(primary)) return "PARTIALLY_PAID";
      return "UNPAID";
    }

    if (!finalInvoice || finalInvoice.Status === "VOIDED") {
      if (invoicePartiallyPaid(primary) || invoiceFullyPaid(primary)) return "PARTIALLY_PAID";
      return "UNPAID";
    }

    const primaryPaid = invoiceFullyPaid(primary);
    const finalPaid = invoiceFullyPaid(finalInvoice);
    const anyPartial = invoicePartiallyPaid(primary) || invoicePartiallyPaid(finalInvoice);

    if (primaryPaid && finalPaid) return "PAID";
    if (anyPartial || primaryPaid || finalPaid) return "PARTIALLY_PAID";
    return "UNPAID";
  }

  if (invoiceFullyPaid(primary)) return "PAID";
  if (invoicePartiallyPaid(primary)) return "PARTIALLY_PAID";
  return "UNPAID";
}

export function buildPaymentBreakdown(input: {
  paymentTerms: PaymentTerms;
  primaryNumber: string | null;
  finalNumber: string | null;
  hasFinalInvoice: boolean;
  primary: XeroInvoicePayment | null;
  final: XeroInvoicePayment | null;
}): XeroPaymentBreakdown {
  if (input.paymentTerms !== "SPLIT_50_50") {
    return {
      advance: {
        number: input.primaryNumber,
        state: invoicePaymentState(input.primary),
      },
      final: { number: null, state: "not_created" },
    };
  }

  return {
    advance: {
      number: input.primaryNumber,
      state: invoicePaymentState(input.primary),
    },
    final: {
      number: input.finalNumber,
      state: input.hasFinalInvoice
        ? invoicePaymentState(input.final)
        : "not_created",
    },
  };
}

type DealForPaymentSync = {
  id: string;
  stage: string;
  paymentTerms: PaymentTerms;
  paymentStatus: PaymentStatus;
  xeroPaymentSyncedAt: Date | null;
  xeroInvoiceId: string | null;
  xeroInvoiceNumber: string | null;
  xeroFinalInvoiceId: string | null;
  xeroFinalInvoiceNumber: string | null;
};

async function fetchInvoicesForDeal(deal: DealForPaymentSync): Promise<{
  primary: XeroInvoicePayment | null;
  final: XeroInvoicePayment | null;
}> {
  if (!deal.xeroInvoiceId) return { primary: null, final: null };

  const primary = await getInvoice(deal.xeroInvoiceId);
  if (primary.Status === "VOIDED") {
    return { primary, final: null };
  }

  let final: XeroInvoicePayment | null = null;
  if (deal.paymentTerms === "SPLIT_50_50" && deal.xeroFinalInvoiceId) {
    final = await getInvoice(deal.xeroFinalInvoiceId);
  }

  return { primary, final };
}

export async function fetchXeroPaymentBreakdown(
  dealDbId: string,
): Promise<XeroPaymentBreakdown | null> {
  if (!isXeroConfigured()) return null;

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: {
      stage: true,
      paymentTerms: true,
      xeroInvoiceId: true,
      xeroInvoiceNumber: true,
      xeroFinalInvoiceId: true,
      xeroFinalInvoiceNumber: true,
    },
  });
  if (!deal || deal.stage !== "WON" || !deal.xeroInvoiceId) return null;

  try {
    const { primary, final } = await fetchInvoicesForDeal(deal as DealForPaymentSync);
    if (!primary) return null;

    return buildPaymentBreakdown({
      paymentTerms: deal.paymentTerms,
      primaryNumber: deal.xeroInvoiceNumber,
      finalNumber: deal.xeroFinalInvoiceNumber,
      hasFinalInvoice: Boolean(deal.xeroFinalInvoiceId),
      primary,
      final,
    });
  } catch (error) {
    console.error(`Xero payment breakdown fetch failed for deal ${dealDbId}:`, error);
    return null;
  }
}

export type SyncDealPaymentResult =
  | { ok: true; changed: boolean; paymentStatus: PaymentStatus; breakdown: XeroPaymentBreakdown | null }
  | { ok: false; error: string };

export async function syncDealPaymentFromXero(dealDbId: string): Promise<SyncDealPaymentResult> {
  if (!isXeroConfigured()) {
    return { ok: false, error: "Xero is not configured" };
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: {
      id: true,
      stage: true,
      paymentTerms: true,
      paymentStatus: true,
      xeroPaymentSyncedAt: true,
      xeroInvoiceId: true,
      xeroInvoiceNumber: true,
      xeroFinalInvoiceId: true,
      xeroFinalInvoiceNumber: true,
    },
  });

  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals sync payment from Xero" };
  if (!deal.xeroInvoiceId) {
    return { ok: false, error: "This deal has no Xero invoice to sync" };
  }

  try {
    const { primary, final } = await fetchInvoicesForDeal(deal);
    if (!primary) return { ok: false, error: "Could not load the Xero invoice" };
    if (primary.Status === "VOIDED") {
      return { ok: false, error: "The Xero invoice was voided — payment status was not changed" };
    }

    const nextStatus = derivePaymentStatus({
      paymentTerms: deal.paymentTerms,
      primary,
      final,
      hasFinalInvoice: Boolean(deal.xeroFinalInvoiceId),
    });

    const breakdown = buildPaymentBreakdown({
      paymentTerms: deal.paymentTerms,
      primaryNumber: deal.xeroInvoiceNumber,
      finalNumber: deal.xeroFinalInvoiceNumber,
      hasFinalInvoice: Boolean(deal.xeroFinalInvoiceId),
      primary,
      final,
    });

    const changed = deal.paymentStatus !== nextStatus;

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        paymentStatus: nextStatus,
        xeroPaymentSyncedAt: deal.xeroPaymentSyncedAt ?? new Date(),
      },
    });

    return { ok: true, changed, paymentStatus: nextStatus, breakdown };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero payment sync failed";
    console.error(`Xero payment sync failed for deal ${dealDbId}:`, error);
    return { ok: false, error: message };
  }
}

export async function syncAllDealPaymentsFromXero(): Promise<{
  scanned: number;
  updated: number;
  errors: number;
}> {
  if (!isXeroConfigured()) {
    return { scanned: 0, updated: 0, errors: 0 };
  }

  const deals = await prisma.deal.findMany({
    where: { stage: "WON", xeroInvoiceId: { not: null } },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
  });

  let updated = 0;
  let errors = 0;

  for (const deal of deals) {
    const result = await syncDealPaymentFromXero(deal.id);
    if (!result.ok) {
      errors += 1;
      continue;
    }
    if (result.changed) updated += 1;
  }

  return { scanned: deals.length, updated, errors };
}
