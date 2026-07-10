"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { clientInputSchema } from "@/lib/client-input";
import { mapClientsForQuotePicker } from "@/lib/client-hierarchy";
import { firstZodError } from "@/lib/zod-errors";

export type ClientActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type ParentCompanyOption = { id: string; name: string };

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

function normalizeParentId(
  parentClientId: string | null | undefined,
  isGroupAccount: boolean,
): string | null {
  if (isGroupAccount) return null;
  const id = parentClientId?.trim();
  return id ? id : null;
}

async function validateParentAssignment(
  clientId: string | null,
  parentClientId: string | null,
  isGroupAccount: boolean,
): Promise<string | null> {
  const parentId = normalizeParentId(parentClientId, isGroupAccount);
  if (!parentId) return null;

  if (clientId && parentId === clientId) {
    return "A client cannot be its own parent company";
  }

  if (clientId) {
    const current = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        _count: { select: { subsidiaries: true, deals: true } },
      },
    });
    if (!current) return "Client not found";
    if (current._count.subsidiaries > 0) {
      return "Group accounts with subsidiaries cannot be assigned to a parent company";
    }
  }

  const parent = await prisma.client.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      parentClientId: true,
      _count: { select: { deals: true } },
    },
  });
  if (!parent) return "Parent company not found";
  if (parent.parentClientId) {
    return "Parent company must be a group head (two levels maximum)";
  }

  if (clientId) {
    const childIds = await prisma.client.findMany({
      where: { parentClientId: clientId },
      select: { id: true },
    });
    if (childIds.some((child) => child.id === parentId)) {
      return "Cannot assign a subsidiary as the parent company";
    }
  }

  return null;
}

export async function listParentCompanyOptions(
  excludeClientId?: string,
): Promise<ParentCompanyOption[]> {
  await requireSalesAccess();

  const rows = await prisma.client.findMany({
    where: {
      parentClientId: null,
      ...(excludeClientId ? { id: { not: excludeClientId } } : {}),
    },
    orderBy: [{ isVip: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return rows;
}

/**
 * Server-backed search for the quote form's client picker — the full
 * directory (with contacts) is never shipped to the browser.
 */
export async function searchClientsAction(rawQuery: string) {
  await requireSalesAccess();

  const query = String(rawQuery ?? "").trim().slice(0, 200);
  const clients = await prisma.client.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : {},
    orderBy: [{ isVip: "desc" }, { name: "asc" }],
    take: 20,
    include: {
      parent: { select: { name: true, isVip: true } },
      contacts: { orderBy: { sortOrder: "asc" } },
      _count: { select: { subsidiaries: true } },
    },
  });
  return mapClientsForQuotePicker(clients);
}

export async function createClientAction(rawInput: unknown): Promise<ClientActionResult> {
  await requireSalesAccess();

  const parsed = clientInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const parentError = await validateParentAssignment(
    null,
    input.parentClientId ?? null,
    input.isGroupAccount,
  );
  if (parentError) return { ok: false, error: parentError };

  const client = await prisma.client.create({
    data: {
      name: input.name,
      registeredAddress: input.isGroupAccount ? "" : input.registeredAddress,
      vatNumber: input.isGroupAccount ? "" : input.vatNumber,
      clientType: input.clientType,
      market: input.market,
      website: input.website,
      isVip: input.isVip,
      parentClientId: normalizeParentId(input.parentClientId, input.isGroupAccount),
      contacts: { create: contactsCreate(input.contacts) },
    },
  });

  revalidatePath("/clients");
  if (client.parentClientId) revalidatePath(`/clients/${client.parentClientId}`);
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

  const existing = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      parentClientId: true,
      _count: { select: { subsidiaries: true } },
    },
  });
  if (!existing) return { ok: false, error: "Client not found" };

  const isGroupHead = existing._count.subsidiaries > 0;
  const parentClientId = isGroupHead
    ? null
    : normalizeParentId(input.parentClientId, input.isGroupAccount);

  const parentError = await validateParentAssignment(id, parentClientId, isGroupHead);
  if (parentError) return { ok: false, error: parentError };

  await prisma.$transaction([
    prisma.clientContact.deleteMany({ where: { clientId: id } }),
    prisma.client.update({
      where: { id },
      data: {
        name: input.name,
        registeredAddress: input.registeredAddress,
        vatNumber: isGroupHead ? "" : input.vatNumber,
        clientType: input.clientType,
        market: input.market,
        website: input.website,
        isVip: input.isVip,
        parentClientId,
        contacts: { create: contactsCreate(input.contacts) },
      },
    }),
  ]);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  if (existing.parentClientId) revalidatePath(`/clients/${existing.parentClientId}`);
  if (parentClientId) revalidatePath(`/clients/${parentClientId}`);
  return { ok: true, id };
}
