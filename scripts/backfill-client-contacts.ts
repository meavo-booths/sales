/**
 * One-off backfill: merge every deal's contacts into its linked client's
 * contact directory (ClientContact). Historically only auto-created clients
 * got contacts; quotes linked to an existing client never propagated theirs.
 *
 * Safe to re-run: matches by email/name and never deletes.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-client-contacts.ts
 */
import { PrismaClient } from "@prisma/client";
import { syncClientContacts } from "../src/lib/client-contacts";

const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.deal.findMany({
    where: { clientId: { not: null } },
    orderBy: { createdAt: "asc" }, // older deals first so newer data wins on merge
    select: {
      quoteNumber: true,
      clientId: true,
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });

  let synced = 0;
  for (const deal of deals) {
    if (!deal.clientId || deal.contacts.length === 0) continue;
    await prisma.$transaction(async (tx) => {
      await syncClientContacts(tx, deal.clientId!, deal.contacts);
    });
    synced += 1;
    console.log(`Merged ${deal.contacts.length} contact(s) from ${deal.quoteNumber}`);
  }

  const total = await prisma.clientContact.count();
  console.log(`Done: processed ${synced} deal(s); ${total} client contacts total.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
