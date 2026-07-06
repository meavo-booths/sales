/**
 * Smoke check: syncClientContacts merges deal contacts into the client
 * directory (dedupes by email/name, fills empty fields, never deletes), and
 * the one-active-assembly-per-deal guard query behaves. Synthetic data only.
 *
 * Run: npx tsx --env-file=.env scripts/contact-sync-check.ts
 */
import { PrismaClient } from "@prisma/client";
import { syncClientContacts } from "../src/lib/client-contacts";

const prisma = new PrismaClient();
const DEAL_ID = "SMOKE-SYNC-DEAL";

async function cleanup() {
  await prisma.assembly.deleteMany({ where: { dealId: { startsWith: `${DEAL_ID}-ASS` } } });
  await prisma.deal.deleteMany({ where: { dealId: DEAL_ID } });
  await prisma.client.deleteMany({ where: { name: "Smoke Sync Client" } });
}

async function main() {
  await cleanup();

  // --- Contact merge ---
  const client = await prisma.client.create({
    data: {
      name: "Smoke Sync Client",
      contacts: {
        create: [{ kind: "MAIN", name: "Ana", email: "ana@x.com", phone: "", sortOrder: 0 }],
      },
    },
  });

  const dealContacts = [
    { kind: "MAIN" as const, name: "Ana Updated", email: "ana@x.com", phone: "+44 1", role: "PM" },
    { kind: "FINANCE" as const, name: "Bo", email: "bo@x.com", phone: "", role: "" },
  ];

  await prisma.$transaction((tx) => syncClientContacts(tx, client.id, dealContacts));
  await prisma.$transaction((tx) => syncClientContacts(tx, client.id, dealContacts)); // idempotent?

  const contacts = await prisma.clientContact.findMany({
    where: { clientId: client.id },
    orderBy: { sortOrder: "asc" },
  });
  if (contacts.length !== 2) throw new Error(`expected 2 client contacts, got ${contacts.length}`);
  const ana = contacts.find((c) => c.email === "ana@x.com");
  if (!ana || ana.name !== "Ana Updated" || ana.phone !== "+44 1" || ana.role !== "PM") {
    throw new Error("email-matched contact was not updated with newer fields");
  }
  if (!contacts.some((c) => c.email === "bo@x.com")) throw new Error("new contact not created");
  console.log("Contact merge: match-by-email update + create + idempotency OK");

  // --- Active assembly guard query ---
  await prisma.deal.create({
    data: {
      quoteNumber: "SMOKE-SYNC-QUOTE",
      stage: "WON",
      dealId: DEAL_ID,
      dealDate: new Date("2026-07-06"),
      clientName: "Smoke Sync Client",
      wonAt: new Date(),
    },
  });
  await prisma.assembly.create({
    data: {
      dealId: `${DEAL_ID}-ASS`,
      linkedDealId: DEAL_ID,
      market: "UK",
      clientName: "Smoke Sync Client",
      source: "APP_CREATED",
      closure: false,
    },
  });

  const guardWhere = {
    closure: false,
    OR: [{ linkedDealId: DEAL_ID }, { dealId: DEAL_ID }],
  };
  const active = await prisma.assembly.findFirst({ where: guardWhere });
  if (!active) throw new Error("guard did not find the open assembly");
  console.log("Guard blocks while an assembly is open OK");

  await prisma.assembly.update({
    where: { dealId: `${DEAL_ID}-ASS` },
    data: { closure: true },
  });
  const afterClose = await prisma.assembly.findFirst({ where: guardWhere });
  if (afterClose) throw new Error("guard still blocks after closure");
  console.log("Guard allows a new assembly after closure OK");

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
