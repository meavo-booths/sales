import type { PaymentTerms, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINISH_LABELS } from "@/lib/deal-values";
import { xeroLineFromQuoteItem } from "@/lib/line-item-pricing";
import { isUsMarket } from "@/lib/zamp/constants";
import { persistedUsTaxAmount } from "@/lib/zamp/calculate-tax";
import { isXeroConfigured } from "@/lib/xero/client";
import { createContact, createDraftInvoice, findContactByName } from "@/lib/xero/resources";
import {
  isXeroSetupConfirmed,
  resolveAccountCodeForMarket,
  resolveAccountCodeForUsState,
  resolveBrandingThemeForMarket,
  resolveBrandingThemeForUsState,
  resolveTaxAccountCodeForUsState,
  resolveTaxTypeForMarket,
  resolveTaxTypeForUsState,
} from "@/lib/xero/settings";
import { normalizeUsState } from "@/lib/us-state";

type DealForXero = Prisma.DealGetPayload<{
  include: {
    lineItems: { include: { product: true } };
    contacts: true;
    client: true;
  };
}>;

export type XeroInvoicePhase = "full" | "advance" | "final";

export type CreateDealXeroInvoiceResult =
  | { ok: true; invoiceId: string; invoiceNumber: string }
  | { ok: false; error: string };

type CreateDealXeroInvoiceOptions = {
  phase: XeroInvoicePhase;
  amountFactor?: 1 | 0.5;
  /** When false, caller persists Xero fields (e.g. inside convert transaction). Default true. */
  persist?: boolean;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Payment terms set the due date; Net 7 invoices are due 7 days after invoice date. */
function dueDateFor(deal: DealForXero, invoiceDate: Date): string {
  if (deal.paymentTerms === "NET_7" || deal.paymentTerms === "NET_30") {
    const due = new Date(invoiceDate);
    due.setUTCDate(due.getUTCDate() + 7);
    return isoDate(due);
  }
  return isoDate(invoiceDate);
}

function lineDescription(item: DealForXero["lineItems"][number]): string {
  const name = item.product?.name ?? item.customName ?? "Item";
  const parts = [
    [name, item.product?.version].filter(Boolean).join(" "),
    item.product?.kind === "BOOTH"
      ? [FINISH_LABELS[item.finish], item.finishDetails].filter(Boolean).join(" — ")
      : "",
    item.description || "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function idempotencyKey(dealDbId: string, phase: XeroInvoicePhase): string {
  const base = `meavo-sales-deal-${dealDbId}`;
  if (phase === "advance") return `${base}-advance`;
  if (phase === "final") return `${base}-final`;
  return base;
}

function invoiceReference(deal: DealForXero, phase: XeroInvoicePhase): string {
  const parts = [deal.dealId, deal.quoteNumber, deal.clientPo].filter(Boolean);
  if (phase === "advance") parts.unshift("50% advance");
  if (phase === "final") parts.unshift("50% final");
  return parts.join(" / ");
}

function defaultAmountFactor(phase: XeroInvoicePhase): 1 | 0.5 {
  return phase === "advance" || phase === "final" ? 0.5 : 1;
}

async function findOrCreateXeroContact(deal: DealForXero): Promise<string> {
  if (deal.client?.xeroContactId) return deal.client.xeroContactId;

  const existing = await findContactByName(deal.clientName);
  let contactId = existing?.ContactID;

  if (!contactId) {
    const financeContact = deal.contacts.find((c) => c.kind === "FINANCE" && c.email);
    const created = await createContact({
      name: deal.clientName,
      email: financeContact?.email || deal.contacts.find((c) => c.email)?.email,
      taxNumber: deal.vatNumber || undefined,
      address: deal.registeredAddress || undefined,
    });
    contactId = created.ContactID;
  }

  if (deal.clientId) {
    await prisma.client.update({
      where: { id: deal.clientId },
      data: { xeroContactId: contactId },
    });
  }
  return contactId;
}

async function loadDealForXero(dealDbId: string): Promise<DealForXero | null> {
  return prisma.deal.findUnique({
    where: { id: dealDbId },
    include: {
      lineItems: { include: { product: true } },
      contacts: true,
      client: true,
    },
  });
}

function phaseGuard(deal: DealForXero, phase: XeroInvoicePhase): CreateDealXeroInvoiceResult | null {
  if (phase === "final") {
    if (!deal.xeroInvoiceId) {
      return { ok: false, error: "Create the advance invoice before the final invoice" };
    }
    if (deal.xeroFinalInvoiceId) {
      return {
        ok: true,
        invoiceId: deal.xeroFinalInvoiceId,
        invoiceNumber: deal.xeroFinalInvoiceNumber ?? "",
      };
    }
    return null;
  }

  if (deal.xeroInvoiceId) {
    return {
      ok: true,
      invoiceId: deal.xeroInvoiceId,
      invoiceNumber: deal.xeroInvoiceNumber ?? "",
    };
  }
  return null;
}

async function resolveXeroMappings(deal: DealForXero) {
  const usDeal = isUsMarket(deal.market);
  const usStateCode = usDeal ? normalizeUsState(deal.usState) : "";

  const [theme, taxType, accountCode, taxAccountCode] = await Promise.all([
    usDeal
      ? resolveBrandingThemeForUsState(usStateCode)
      : resolveBrandingThemeForMarket(deal.market),
    usDeal ? resolveTaxTypeForUsState(usStateCode) : resolveTaxTypeForMarket(deal.market),
    usDeal ? resolveAccountCodeForUsState(usStateCode) : resolveAccountCodeForMarket(deal.market),
    usDeal ? resolveTaxAccountCodeForUsState(usStateCode) : Promise.resolve(null),
  ]);

  if (usDeal && !usStateCode) {
    throw new Error(
      "US deal is missing a valid ship-to state — set state on the deal before exporting to Xero",
    );
  }
  if (!theme) {
    throw new Error(
      usDeal
        ? `No Xero branding theme mapped for US state "${usStateCode}" and no US default set`
        : `No Xero branding theme mapped for market "${deal.market || "(none)"}" and no default set`,
    );
  }
  if (!taxType) {
    throw new Error(
      usDeal
        ? `No Xero tax type mapped for US state "${usStateCode}" and no US default set`
        : `No Xero tax type mapped for market "${deal.market || "(none)"}" and no default set`,
    );
  }
  if (!accountCode) {
    throw new Error(
      usDeal
        ? `No Xero revenue account mapped for US state "${usStateCode}" and no US default set`
        : `No Xero revenue account mapped for market "${deal.market || "(none)"}" and no default set`,
    );
  }

  return { usDeal, usStateCode, theme, taxType, accountCode, taxAccountCode };
}

/**
 * Create a draft ACCREC invoice in Xero for a deal. Used synchronously at
 * conversion (auto DealID) and from manual/retry actions. Returns existing
 * invoice ids when the phase was already synced.
 */
export async function createDealXeroInvoice(
  dealDbId: string,
  options: CreateDealXeroInvoiceOptions,
): Promise<CreateDealXeroInvoiceResult> {
  const { phase, persist = true } = options;
  const amountFactor = options.amountFactor ?? defaultAmountFactor(phase);

  const deal = await loadDealForXero(dealDbId);
  if (!deal) return { ok: false, error: "Deal not found" };

  const existing = phaseGuard(deal, phase);
  if (existing) return existing;

  if (!isXeroConfigured()) {
    return { ok: false, error: "Xero is not configured" };
  }

  if (!(await isXeroSetupConfirmed())) {
    return {
      ok: false,
      error:
        "Xero setup is not confirmed — complete mapping review in Settings → Xero and Settings → Xero US",
    };
  }

  try {
    const { usDeal, usStateCode, theme, taxType, accountCode, taxAccountCode } =
      await resolveXeroMappings(deal);

    const contactId = await findOrCreateXeroContact(deal);

    const sorted = [...deal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
    const lineItems = sorted.map((item) => {
      const xeroLine = xeroLineFromQuoteItem(item, amountFactor, deal.currency);
      const description = xeroLine.descriptionSuffix
        ? `${lineDescription(item)} · ${xeroLine.descriptionSuffix}`
        : lineDescription(item);
      return {
        Description: description,
        Quantity: item.quantity,
        UnitAmount: xeroLine.UnitAmount,
        ...(xeroLine.DiscountRate != null ? { DiscountRate: xeroLine.DiscountRate } : {}),
        TaxType: taxType,
        AccountCode: accountCode,
        ...(item.product?.xeroItemCode ? { ItemCode: item.product.xeroItemCode } : {}),
      };
    });

    const usTaxAmount = usDeal ? persistedUsTaxAmount(deal) * amountFactor : 0;
    if (usTaxAmount > 0) {
      if (!taxAccountCode) {
        throw new Error(
          `No Xero tax liability account mapped for US state "${usStateCode}" and no US default set`,
        );
      }
      lineItems.push({
        Description: "US Sales Tax",
        Quantity: 1,
        UnitAmount: usTaxAmount,
        TaxType: taxType,
        AccountCode: taxAccountCode,
      });
    }

    const invoiceDate = new Date();
    const invoice = await createDraftInvoice({
      contactId,
      date: isoDate(invoiceDate),
      dueDate: dueDateFor(deal, invoiceDate),
      reference: invoiceReference(deal, phase),
      currencyCode: deal.currency,
      brandingThemeId: theme.id,
      lineItems,
      idempotencyKey: idempotencyKey(dealDbId, phase),
    });

    const invoiceId = invoice.InvoiceID;
    const invoiceNumber = invoice.InvoiceNumber?.trim() ?? "";
    if (!invoiceNumber) {
      return { ok: false, error: "Xero returned an invoice without a number" };
    }

    if (persist) {
      if (phase === "final") {
        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            xeroFinalInvoiceId: invoiceId,
            xeroFinalInvoiceNumber: invoiceNumber,
            xeroFinalSyncedAt: new Date(),
            xeroFinalSyncError: null,
          },
        });
      } else {
        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            xeroInvoiceId: invoiceId,
            xeroInvoiceNumber: invoiceNumber,
            xeroSyncedAt: new Date(),
            xeroSyncError: null,
          },
        });
      }
    }

    return { ok: true, invoiceId, invoiceNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero invoice creation failed";
    console.error(`Xero invoice creation failed for deal ${dealDbId} (${phase}):`, error);

    if (persist) {
      if (phase === "final") {
        await prisma.deal.update({
          where: { id: deal.id },
          data: { xeroFinalSyncError: message },
        });
      } else {
        await prisma.deal.update({
          where: { id: deal.id },
          data: { xeroSyncError: message },
        });
      }
    }

    return { ok: false, error: message };
  }
}

function primaryPhaseForTerms(paymentTerms: PaymentTerms): XeroInvoicePhase {
  return paymentTerms === "SPLIT_50_50" ? "advance" : "full";
}

function shouldSkipBackgroundXero(deal: DealForXero): boolean {
  if (deal.skipXeroOnWin) return true;
  if (deal.paymentTerms === "NET_7" || deal.paymentTerms === "NET_30") return true;
  if (deal.xeroInvoiceId) return true;
  return false;
}

/**
 * Background export after win. Picks phase from payment terms and existing
 * ids; skips when Xero was deferred or already created at conversion.
 */
export async function exportDealToXero(dealDbId: string): Promise<void> {
  const deal = await loadDealForXero(dealDbId);
  if (!deal || deal.stage !== "WON" || !deal.dealId) return;
  if (shouldSkipBackgroundXero(deal)) return;

  if (!isXeroConfigured()) return;

  const phase = primaryPhaseForTerms(deal.paymentTerms);
  await createDealXeroInvoice(dealDbId, { phase });
}

/** Phase for manual primary invoice creation on a won deal. */
export function primaryInvoicePhase(paymentTerms: PaymentTerms): XeroInvoicePhase {
  return primaryPhaseForTerms(paymentTerms);
}
