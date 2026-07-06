import type { Prisma } from "@prisma/client";

export type ContactValues = {
  kind: "MAIN" | "FINANCE";
  name: string;
  email: string;
  phone: string;
  role: string;
};

/**
 * Merge deal contacts into the client's contact directory. Matches existing
 * client contacts by email (fallback: name, both case-insensitive), fills in
 * any newer non-empty fields on matches, and creates the rest. Never deletes,
 * so the client directory only ever grows.
 */
export async function syncClientContacts(
  tx: Prisma.TransactionClient,
  clientId: string,
  contacts: ContactValues[],
): Promise<void> {
  const existing = await tx.clientContact.findMany({ where: { clientId } });

  const byEmail = new Map(
    existing
      .filter((contact) => contact.email.trim())
      .map((contact) => [contact.email.trim().toLowerCase(), contact]),
  );
  const byName = new Map(
    existing
      .filter((contact) => contact.name.trim())
      .map((contact) => [contact.name.trim().toLowerCase(), contact]),
  );

  let nextSortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);

  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    const name = contact.name.trim().toLowerCase();
    if (!email && !name) continue;

    const match = (email ? byEmail.get(email) : undefined) ?? byName.get(name);

    if (match) {
      await tx.clientContact.update({
        where: { id: match.id },
        data: {
          name: contact.name.trim() || match.name,
          email: contact.email.trim() || match.email,
          phone: contact.phone.trim() || match.phone,
          role: contact.role.trim() || match.role,
        },
      });
    } else {
      const created = await tx.clientContact.create({
        data: {
          clientId,
          kind: contact.kind,
          name: contact.name.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          role: contact.role.trim(),
          sortOrder: nextSortOrder++,
        },
      });
      if (email) byEmail.set(email, created);
      if (name) byName.set(name, created);
    }
  }
}
