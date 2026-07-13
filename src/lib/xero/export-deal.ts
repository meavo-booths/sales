import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FINISH_LABELS } from "@/lib/deal-values";
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

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Payment terms only set the due date; one invoice per deal. */
function dueDateFor(deal: DealForXero, invoiceDate: Date): string {
  if (deal.paymentTerms === "NET_30") {
    const due = new Date(invoiceDate);
    due.setUTCDate(due.getUTCDate() + 30);
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

/**
 * Create a draft ACCREC invoice in Xero for a won deal. Records the invoice
 * reference or the error on the Deal; never throws, so a Xero outage doesn't
 * block the conversion. Safe to re-run: skips deals that already synced.
 */
export async function exportDealToXero(dealDbId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    include: {
      lineItems: { include: { product: true } },
      contacts: true,
      client: true,
    },
  });
  if (!deal || deal.stage !== "WON" || !deal.dealId) return;
  if (deal.xeroInvoiceId) return;

  const fail = async (message: string) => {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { xeroSyncError: message },
    });
  };

  // No credentials -> integration is off; skip silently so deals won before
  // the Xero rollout don't show a warning. (The manual retry button still
  // reports this state via retryXeroInvoiceAction.)
  if (!isXeroConfigured()) return;

  if (!(await isXeroSetupConfirmed())) {
    await fail(
      "Xero setup is not confirmed — complete mapping review in Settings → Xero and Settings → Xero US",
    );
    return;
  }

  try {
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
      throw new Error("US deal is missing a valid ship-to state — set state on the deal before exporting to Xero");
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

    const contactId = await findOrCreateXeroContact(deal);

    const sorted = [...deal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
    // AccountCode is always set explicitly so market-based revenue coding wins
    // over any default account configured on the Xero item.
    const lineItems = sorted.map((item) => ({
      Description: lineDescription(item),
      Quantity: item.quantity,
      UnitAmount: Number(item.unitPrice),
      TaxType: taxType,
      AccountCode: accountCode,
      ...(item.product?.xeroItemCode ? { ItemCode: item.product.xeroItemCode } : {}),
    }));

    const usTaxAmount = usDeal ? persistedUsTaxAmount(deal) : 0;
    if (usTaxAmount > 0) {
      if (!taxAccountCode) {
        throw new Error(
          `No Xero tax liability account mapped for US state "${usStateCode}" and no US default set`,
        );
      }
      // Zamp-computed US sales tax posts to the state tax liability account.
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
      reference: [deal.dealId, deal.quoteNumber, deal.clientPo].filter(Boolean).join(" / "),
      currencyCode: deal.currency,
      brandingThemeId: theme.id,
      lineItems,
      // Deal IDs are unique, so retries after partial failures can't create
      // a duplicate invoice in Xero.
      idempotencyKey: `meavo-sales-deal-${deal.dealId}`,
    });

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        xeroInvoiceId: invoice.InvoiceID,
        xeroInvoiceNumber: invoice.InvoiceNumber || null,
        xeroSyncedAt: new Date(),
        xeroSyncError: null,
      },
    });
  } catch (error) {
    console.error(`Xero invoice creation failed for deal ${deal.dealId}:`, error);
    await fail(error instanceof Error ? error.message : "Xero invoice creation failed");
  }
}
