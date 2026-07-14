"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { nextQuoteNumber } from "@/lib/quote-number";
import { quoteInputSchema, type QuoteInput } from "@/lib/quote-input";
import { syncClientContacts } from "@/lib/client-contacts";
import { fetchExchangeRateToEur, isQuoteCurrency } from "@/lib/exchange-rates";
import { productMatchesAvailability } from "@/lib/product-availability";
import { addOnCompatibleWithBoothFamily } from "@/lib/addon-compatibility";
import { firstZodError } from "@/lib/zod-errors";
import { resolveUsTaxForQuoteInput } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";

export type QuoteActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

function contactsCreate(input: QuoteInput) {
  return input.contacts.map((contact, index) => ({
    kind: contact.kind,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: contact.role,
    sortOrder: index,
  }));
}

/**
 * Booth lines must use booth products; add-on lines must use add-on products;
 * add-ons attached to a booth must be compatible with that booth's family
 * (the same rule the form uses to filter options — enforced here so nothing
 * bypassing the form can persist incompatible add-ons).
 */
async function validateProductKinds(input: QuoteInput): Promise<string | null> {
  const boothIds = input.lineItems.map((item) => item.productId);
  const addOnIds = [
    ...input.lineItems.flatMap((item) => item.addOns.map((a) => a.productId)),
    ...input.standaloneAddOns.map((a) => a.productId),
  ];

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set([...boothIds, ...addOnIds])] } },
    select: {
      id: true,
      kind: true,
      name: true,
      boothFamily: true,
      familyRestrictions: { select: { boothFamily: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const id of boothIds) {
    const product = byId.get(id);
    if (!product) return "A selected product no longer exists";
    if (product.kind !== "BOOTH") return `${product.name} is an add-on — attach it as one`;
  }
  for (const id of addOnIds) {
    const product = byId.get(id);
    if (!product) return "A selected add-on no longer exists";
    if (product.kind !== "ADDON") return `${product.name} is not an add-on`;
  }

  for (const item of input.lineItems) {
    const booth = byId.get(item.productId);
    for (const addOn of item.addOns) {
      const addOnProduct = byId.get(addOn.productId)!;
      const restricted = addOnProduct.familyRestrictions.map((r) => r.boothFamily);
      if (!addOnCompatibleWithBoothFamily(restricted, booth?.boothFamily)) {
        return `${addOnProduct.name} is not compatible with ${booth?.name ?? "this booth"}`;
      }
    }
  }
  return null;
}

async function validateProductAvailability(input: QuoteInput): Promise<string | null> {
  if (!input.market) return null;

  const productIds = [
    ...new Set([
      ...input.lineItems.map((item) => item.productId),
      ...input.lineItems.flatMap((item) => item.addOns.map((addOn) => addOn.productId)),
      ...input.standaloneAddOns.map((addOn) => addOn.productId),
    ]),
  ];
  if (productIds.length === 0) return null;

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      availability: { select: { market: true, clientType: true } },
    },
  });

  for (const product of products) {
    if (
      !productMatchesAvailability(product.availability, input.market, input.clientType)
    ) {
      return `${product.name} is not available for ${input.market} / ${input.clientType}`;
    }
  }
  return null;
}

function unitPriceEurValue(unitPrice: number, exchangeRateToEur: number): Prisma.Decimal {
  return new Prisma.Decimal((unitPrice * exchangeRateToEur).toFixed(2));
}

/**
 * Link the picked client, or create a new one from the quote's client fields.
 * Either way the quote's contacts are merged into the client's directory so
 * contacts live on the client, not only on the deal.
 */
async function resolveClientId(tx: Tx, input: QuoteInput): Promise<string> {
  let clientId: string;

  if (input.clientId) {
    const client = await tx.client.findUnique({
      where: { id: input.clientId },
      select: { id: true },
    });
    if (!client) throw new Error("The selected client no longer exists");
    clientId = client.id;
    await tx.client.update({
      where: { id: clientId },
      data: { isVip: input.isVip },
    });
  } else {
    const client = await tx.client.create({
      data: {
        name: input.clientName,
        registeredAddress: input.registeredAddress,
        vatNumber: input.vatNumber,
        clientType: input.clientType,
        market: input.market,
        website: input.website,
        isVip: input.isVip,
      },
    });
    clientId = client.id;
  }

  await syncClientContacts(tx, clientId, input.contacts);
  return clientId;
}

/** Creates booth lines, their attached add-ons, then standalone add-ons. */
async function createLineItems(
  tx: Tx,
  dealId: string,
  input: QuoteInput,
  exchangeRateToEur: number,
): Promise<void> {
  let sortOrder = 0;

  for (const item of input.lineItems) {
    const parent = await tx.quoteLineItem.create({
      data: {
        dealId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
        unitPriceEur: unitPriceEurValue(item.unitPrice, exchangeRateToEur),
        finish: item.finish,
        finishDetails: item.finishDetails,
        description: item.description,
        sortOrder: sortOrder++,
      },
    });
    for (const addOn of item.addOns) {
      await tx.quoteLineItem.create({
        data: {
          dealId,
          productId: addOn.productId,
          quantity: addOn.quantity,
          unitPrice: new Prisma.Decimal(addOn.unitPrice.toFixed(2)),
          unitPriceEur: unitPriceEurValue(addOn.unitPrice, exchangeRateToEur),
          description: addOn.description,
          sortOrder: sortOrder++,
          parentLineItemId: parent.id,
        },
      });
    }
  }

  for (const addOn of input.standaloneAddOns) {
    await tx.quoteLineItem.create({
      data: {
        dealId,
        productId: addOn.productId,
        quantity: addOn.quantity,
        unitPrice: new Prisma.Decimal(addOn.unitPrice.toFixed(2)),
        unitPriceEur: unitPriceEurValue(addOn.unitPrice, exchangeRateToEur),
        description: addOn.description,
        sortOrder: sortOrder++,
      },
    });
  }

  for (const custom of input.customLines) {
    await tx.quoteLineItem.create({
      data: {
        dealId,
        customName: custom.name,
        quantity: custom.quantity,
        unitPrice: new Prisma.Decimal(custom.unitPrice.toFixed(2)),
        unitPriceEur: unitPriceEurValue(custom.unitPrice, exchangeRateToEur),
        description: custom.description,
        sortOrder: sortOrder++,
      },
    });
  }
}

export async function createQuoteAction(rawInput: unknown): Promise<QuoteActionResult> {
  const session = await requireSalesAccess();

  const parsed = quoteInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const kindError = await validateProductKinds(input);
  if (kindError) return { ok: false, error: kindError };

  const availabilityError = await validateProductAvailability(input);
  if (availabilityError) return { ok: false, error: availabilityError };

  const currency = isQuoteCurrency(input.currency) ? input.currency : "EUR";

  try {
    const exchangeRateToEur = await fetchExchangeRateToEur(currency);
    const quoteNumber = await nextQuoteNumber();
    const usTax = isUsMarket(input.market)
      ? await resolveUsTaxForQuoteInput(input, { quoteNumber })
      : { usTaxAmount: new Prisma.Decimal(0), usTaxDetail: null };

    const dealId = await prisma.$transaction(async (tx) => {
      const clientId = await resolveClientId(tx, input);
      const deal = await tx.deal.create({
        data: {
          quoteNumber,
          clientId,
          dealDate: input.dealDate,
          salesRep: input.salesRep || (session.user.name ?? ""),
          market: input.market,
          usState: input.usState,
          shipToLine1: input.shipToLine1,
          shipToLine2: input.shipToLine2,
          shipToCity: input.shipToCity,
          shipToZip: input.shipToZip,
          usTaxAmount: usTax.usTaxAmount,
          usTaxDetail: usTax.usTaxDetail ?? undefined,
          socketType: input.socketType,
          targetDeliveryDate: input.targetDeliveryDate,
          deliveryType: input.deliveryType,
          clientName: input.clientName,
          registeredAddress: input.registeredAddress,
          website: input.website,
          assemblyAddress: input.assemblyAddress,
          clientPo: input.clientPo,
          actualClient: input.actualClient,
          vatNumber: input.vatNumber,
          clientType: input.clientType,
          currency,
          exchangeRateToEur: new Prisma.Decimal(exchangeRateToEur.toFixed(8)),
          paymentTerms: input.paymentTerms,
          notes: input.notes,
          createdByUserId: session.user.id,
          contacts: { create: contactsCreate(input) },
        },
      });
      await createLineItems(tx, deal.id, input, exchangeRateToEur);
      return deal.id;
    });

    revalidatePath("/");
    revalidatePath("/clients");
    return { ok: true, id: dealId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save quote" };
  }
}

export async function updateQuoteAction(
  id: string,
  rawInput: unknown,
): Promise<QuoteActionResult> {
  await requireSalesAccess();

  const parsed = quoteInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const existing = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!existing) return { ok: false, error: "Quote not found" };
  if (existing.stage !== "QUOTE") {
    return { ok: false, error: "Only open quotes can be edited" };
  }

  const kindError = await validateProductKinds(input);
  if (kindError) return { ok: false, error: kindError };

  const availabilityError = await validateProductAvailability(input);
  if (availabilityError) return { ok: false, error: availabilityError };

  const currency = isQuoteCurrency(input.currency) ? input.currency : "EUR";

  try {
    const exchangeRateToEur = await fetchExchangeRateToEur(currency);
    const usTax = isUsMarket(input.market)
      ? await resolveUsTaxForQuoteInput(input, { id })
      : { usTaxAmount: new Prisma.Decimal(0), usTaxDetail: null };

    await prisma.$transaction(async (tx) => {
      const clientId = await resolveClientId(tx, input);
      await tx.dealContact.deleteMany({ where: { dealId: id } });
      await tx.quoteLineItem.deleteMany({ where: { dealId: id } });
      await tx.deal.update({
        where: { id },
        data: {
          clientId,
          dealDate: input.dealDate,
          salesRep: input.salesRep,
          market: input.market,
          usState: input.usState,
          shipToLine1: input.shipToLine1,
          shipToLine2: input.shipToLine2,
          shipToCity: input.shipToCity,
          shipToZip: input.shipToZip,
          usTaxAmount: usTax.usTaxAmount,
          usTaxDetail: usTax.usTaxDetail ?? undefined,
          socketType: input.socketType,
          targetDeliveryDate: input.targetDeliveryDate,
          deliveryType: input.deliveryType,
          clientName: input.clientName,
          registeredAddress: input.registeredAddress,
          website: input.website,
          assemblyAddress: input.assemblyAddress,
          clientPo: input.clientPo,
          actualClient: input.actualClient,
          vatNumber: input.vatNumber,
          clientType: input.clientType,
          currency,
          exchangeRateToEur: new Prisma.Decimal(exchangeRateToEur.toFixed(8)),
          paymentTerms: input.paymentTerms,
          notes: input.notes,
          contacts: { create: contactsCreate(input) },
        },
      });
      await createLineItems(tx, id, input, exchangeRateToEur);
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save quote" };
  }

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/quotes/${id}`);
  return { ok: true, id };
}

export async function deleteQuoteAction(id: string): Promise<QuoteActionResult> {
  await requireSalesAccess();

  const existing = await prisma.deal.findUnique({ where: { id }, select: { stage: true } });
  if (!existing) return { ok: false, error: "Quote not found" };
  if (existing.stage !== "QUOTE") {
    return { ok: false, error: "Only open quotes can be deleted" };
  }

  await prisma.deal.delete({ where: { id } });
  revalidatePath("/");
  return { ok: true, id };
}
