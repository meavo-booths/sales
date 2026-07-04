/**
 * One-off backfill: create a Client per distinct Deal.clientName (using the
 * most recent deal's details) and link existing deals via Deal.clientId.
 * Idempotent — deals that already have a clientId are left alone, and clients
 * are matched by exact name if they already exist.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-clients.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.deal.findMany({
    where: { clientId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientName: true,
      registeredAddress: true,
      vatNumber: true,
      clientType: true,
      market: true,
    },
  });
  console.log(`Deals without a client: ${deals.length}`);

  // Most recent deal first, so the first occurrence has the freshest details.
  const byName = new Map<string, typeof deals>();
  for (const deal of deals) {
    const name = deal.clientName.trim();
    if (!name) continue;
    const group = byName.get(name) ?? [];
    group.push(deal);
    byName.set(name, group);
  }

  for (const [name, group] of byName) {
    const latest = group[0];
    let client = await prisma.client.findFirst({ where: { name } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name,
          registeredAddress: latest.registeredAddress,
          vatNumber: latest.vatNumber,
          clientType: latest.clientType,
          market: latest.market,
        },
      });
      console.log(`Created client "${name}"`);
    }
    await prisma.deal.updateMany({
      where: { id: { in: group.map((d) => d.id) } },
      data: { clientId: client.id },
    });
    console.log(`  linked ${group.length} deal(s)`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
