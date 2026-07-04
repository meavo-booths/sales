"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { nextQuoteNumber } from "@/lib/quote-number";
import { quoteInputSchema } from "@/lib/quote-input";

export type QuoteActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function firstZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues.length > 0) return issues[0].message;
  }
  return "Invalid input";
}

function contactsCreate(input: ReturnType<typeof quoteInputSchema.parse>) {
  return input.contacts.map((contact, index) => ({
    kind: contact.kind,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: contact.role,
    sortOrder: index,
  }));
}

function lineItemsCreate(input: ReturnType<typeof quoteInputSchema.parse>) {
  return input.lineItems.map((item, index) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
    finish: item.finish,
    finishDetails: item.finishDetails,
    description: item.description,
    sortOrder: index,
  }));
}

export async function createQuoteAction(rawInput: unknown): Promise<QuoteActionResult> {
  const session = await requireSalesAccess();

  const parsed = quoteInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const quoteNumber = await nextQuoteNumber();

  const deal = await prisma.deal.create({
    data: {
      quoteNumber,
      dealDate: input.dealDate,
      salesRep: input.salesRep || (session.user.name ?? ""),
      market: input.market,
      clientName: input.clientName,
      registeredAddress: input.registeredAddress,
      vatNumber: input.vatNumber,
      clientType: input.clientType,
      paymentTerms: input.paymentTerms,
      notes: input.notes,
      createdByUserId: session.user.id,
      contacts: { create: contactsCreate(input) },
      lineItems: { create: lineItemsCreate(input) },
    },
  });

  revalidatePath("/");
  return { ok: true, id: deal.id };
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

  await prisma.$transaction([
    prisma.dealContact.deleteMany({ where: { dealId: id } }),
    prisma.quoteLineItem.deleteMany({ where: { dealId: id } }),
    prisma.deal.update({
      where: { id },
      data: {
        dealDate: input.dealDate,
        salesRep: input.salesRep,
        market: input.market,
        clientName: input.clientName,
        registeredAddress: input.registeredAddress,
        vatNumber: input.vatNumber,
        clientType: input.clientType,
        paymentTerms: input.paymentTerms,
        notes: input.notes,
        contacts: { create: contactsCreate(input) },
        lineItems: { create: lineItemsCreate(input) },
      },
    }),
  ]);

  revalidatePath("/");
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
