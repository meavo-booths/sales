/**
 * Smoke check for the ready-to-assemble flow: deal with assemblyAddress +
 * readyToAssemble, two assemblies linked via linkedDealId (different event
 * types), rename one, then confirm deleting the deal detaches (not deletes)
 * the assemblies. All synthetic data; cleaned up at the end.
 *
 * Run: npx tsx --env-file=.env scripts/ready-to-assemble-check.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEAL_ID = "SMOKE-RTA-DEAL";

async function cleanup() {
  await prisma.assembly.deleteMany({ where: { dealId: { startsWith: `${DEAL_ID}-ASS` } } });
  await prisma.deal.deleteMany({ where: { dealId: DEAL_ID } });
}

async function main() {
  await cleanup();

  const deal = await prisma.deal.create({
    data: {
      quoteNumber: "SMOKE-RTA-QUOTE",
      stage: "WON",
      dealId: DEAL_ID,
      dealDate: new Date("2026-07-06"),
      clientName: "Smoke Test Client",
      assemblyAddress: "1 Install Street, London",
      readyToAssemble: true,
      wonAt: new Date(),
    },
  });
  console.log("Deal created with assemblyAddress + readyToAssemble:", deal.dealId);

  const ready = await prisma.deal.findMany({
    where: { stage: "WON", readyToAssemble: true, dealId: DEAL_ID },
  });
  if (ready.length !== 1) throw new Error("ready-deals query did not find the deal");
  console.log("Ready-deals query finds it OK");

  await prisma.assembly.create({
    data: {
      dealId: `${DEAL_ID}-ASS`,
      linkedDealId: DEAL_ID,
      market: "UK",
      clientName: deal.clientName,
      eventType: "ASSEMBLY",
      source: "APP_CREATED",
    },
  });
  await prisma.assembly.create({
    data: {
      dealId: `${DEAL_ID}-ASS2`,
      linkedDealId: DEAL_ID,
      market: "UK",
      clientName: deal.clientName,
      eventType: "REPAIR",
      source: "APP_CREATED",
    },
  });

  const withAssemblies = await prisma.deal.findUniqueOrThrow({
    where: { id: deal.id },
    include: { assemblies: { orderBy: { dealId: "asc" } } },
  });
  if (withAssemblies.assemblies.length !== 2) {
    throw new Error("deal.assemblies relation did not return both assemblies");
  }
  console.log(
    "Two assemblies linked to one deal:",
    withAssemblies.assemblies.map((a) => `${a.dealId} (${a.eventType})`).join(", "),
  );

  // Sales deal page query shape (linked or legacy exact-ID match).
  const linked = await prisma.assembly.findMany({
    where: { OR: [{ linkedDealId: DEAL_ID }, { dealId: DEAL_ID }] },
  });
  if (linked.length !== 2) throw new Error("deal page OR-query did not find both");
  console.log("Deal page OR-query finds both OK");

  // Rename an assembly; the deal link must survive.
  const renamed = await prisma.assembly.update({
    where: { dealId: `${DEAL_ID}-ASS2` },
    data: { dealId: `${DEAL_ID}-ASS-REPAIR` },
  });
  if (renamed.linkedDealId !== DEAL_ID) throw new Error("rename dropped the deal link");
  console.log("Rename keeps the deal link OK");

  // Deleting the deal must detach assemblies (SET NULL), not delete them.
  await prisma.deal.delete({ where: { id: deal.id } });
  const orphans = await prisma.assembly.findMany({
    where: { dealId: { startsWith: `${DEAL_ID}-ASS` } },
  });
  if (orphans.length !== 2 || orphans.some((a) => a.linkedDealId !== null)) {
    throw new Error("deal deletion did not SET NULL the assembly links");
  }
  console.log("Deal deletion detaches assemblies (SET NULL) OK");

  await cleanup();
  console.log("Smoke check passed ✔");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
  });
