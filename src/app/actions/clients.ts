"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { clientInputSchema } from "@/lib/client-input";

export type ClientActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function firstZodError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues.length > 0) return issues[0].message;
  }
  return "Invalid input";
}

function contactsCreate(contacts: ReturnType<typeof clientInputSchema.parse>["contacts"]) {
  return contacts.map((contact, index) => ({
    kind: contact.kind,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: contact.role,
    sortOrder: index,
  }));
}

export async function createClientAction(rawInput: unknown): Promise<ClientActionResult> {
  await requireSalesAccess();

  const parsed = clientInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const client = await prisma.client.create({
    data: {
      name: input.name,
      registeredAddress: input.registeredAddress,
      vatNumber: input.vatNumber,
      clientType: input.clientType,
      market: input.market,
      website: input.website,
      isVip: input.isVip,
      contacts: { create: contactsCreate(input.contacts) },
    },
  });

  revalidatePath("/clients");
  return { ok: true, id: client.id };
}

export async function updateClientAction(
  id: string,
  rawInput: unknown,
): Promise<ClientActionResult> {
  await requireSalesAccess();

  const parsed = clientInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const existing = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Client not found" };

  await prisma.$transaction([
    prisma.clientContact.deleteMany({ where: { clientId: id } }),
    prisma.client.update({
      where: { id },
      data: {
        name: input.name,
        registeredAddress: input.registeredAddress,
        vatNumber: input.vatNumber,
        clientType: input.clientType,
        market: input.market,
        website: input.website,
        isVip: input.isVip,
        contacts: { create: contactsCreate(input.contacts) },
      },
    }),
  ]);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id };
}
