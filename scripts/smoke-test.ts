/**
 * End-to-end smoke test for the core flow, run directly against the DB:
 * client + linked quote (with attached & standalone add-ons) -> conversion
 * (booth units exclude add-ons) -> Ops File grouping -> PDF render.
 * Cleans up after itself and resets the quote-number sequence.
 *
 * Run: npx tsx --env-file=.env scripts/smoke-test.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { QuotePdfDocument } from "../src/lib/quote-pdf";
import { buildExportGroups } from "../src/lib/ops-sheet-export";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function cleanup() {
  await prisma.deal.deleteMany({ where: { clientName: "Smoke Test GmbH" } });
  await prisma.client.deleteMany({ where: { name: "Smoke Test GmbH" } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "SMOKE-ADDON" } } });
}

async function main() {
  // Clean up anything left behind by previous failed runs.
  await cleanup();

  const next = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT nextval('"SalesQuoteNumberSeq"') AS n
  `;
  const quoteNumber = `MQ-${String(Number(next[0].n)).padStart(5, "0")}`;
  console.log("Quote number:", quoteNumber);

  const [soho, camden] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { sku: "MEAVO-SOHO" } }),
    prisma.product.findUniqueOrThrow({ where: { sku: "MEAVO-CAMDEN-4" } }),
  ]);

  // Temp add-on products.
  const [warranty, chair] = await Promise.all([
    prisma.product.create({
      data: { name: "Extra warranty", sku: "SMOKE-ADDON-WARRANTY", kind: "ADDON", listPrice: new Prisma.Decimal("350.00") },
    }),
    prisma.product.create({
      data: { name: "Ergonomic chair", sku: "SMOKE-ADDON-CHAIR", kind: "ADDON", listPrice: new Prisma.Decimal("420.00") },
    }),
  ]);
  console.log("Add-on products created:", warranty.sku, chair.sku);

  // Client with contacts (mirrors createClientAction).
  const client = await prisma.client.create({
    data: {
      name: "Smoke Test GmbH",
      registeredAddress: "Teststrasse 1, Berlin",
      vatNumber: "DE123456789",
      clientType: "DIRECT",
      market: "Germany",
      website: "https://smoketest.example.com",
      isVip: true,
      contacts: {
        create: [
          { kind: "MAIN", name: "Max Mustermann", email: "max@example.com", role: "Office manager", sortOrder: 0 },
          { kind: "FINANCE", name: "Erika Musterfrau", email: "ap@example.com", sortOrder: 1 },
        ],
      },
    },
    include: { contacts: true },
  });
  console.log("Client created:", client.id, "contacts:", client.contacts.length);

  // Quote linked to the client, contacts snapshot pre-filled from the client.
  const deal = await prisma.deal.create({
    data: {
      quoteNumber,
      clientId: client.id,
      dealDate: new Date(),
      salesRep: "Smoke Test",
      market: client.market,
      clientName: client.name,
      registeredAddress: client.registeredAddress,
      vatNumber: client.vatNumber,
      clientType: client.clientType,
      paymentTerms: "SPLIT_50_50",
      notes: "smoke test — will be deleted",
      contacts: {
        create: client.contacts.map((c, i) => ({
          kind: c.kind,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          sortOrder: i,
        })),
      },
    },
  });

  // Booth lines + attached add-on (on the Soho line) + standalone add-on.
  const sohoLine = await prisma.quoteLineItem.create({
    data: { dealId: deal.id, productId: soho.id, quantity: 2, unitPrice: new Prisma.Decimal("4500.00"), finish: "WHITE_STOCK", sortOrder: 0 },
  });
  await prisma.quoteLineItem.create({
    data: { dealId: deal.id, productId: warranty.id, quantity: 2, unitPrice: new Prisma.Decimal("350.00"), sortOrder: 1, parentLineItemId: sohoLine.id },
  });
  await prisma.quoteLineItem.create({
    data: { dealId: deal.id, productId: camden.id, quantity: 1, unitPrice: new Prisma.Decimal("12500.00"), finish: "CUSTOM", finishDetails: "RAL 7016", sortOrder: 2 },
  });
  await prisma.quoteLineItem.create({
    data: { dealId: deal.id, productId: chair.id, quantity: 1, unitPrice: new Prisma.Decimal("420.00"), sortOrder: 3 },
  });
  console.log("Created deal:", deal.id, "with 2 booth lines, 1 attached add-on, 1 standalone add-on");

  // Convert (mirrors convertQuoteAction without auth) — add-ons excluded.
  const withItems = await prisma.deal.findUniqueOrThrow({
    where: { id: deal.id },
    include: { lineItems: { include: { product: true } } },
  });
  const dealId = `SMOKE-${Date.now()}`;
  const boothUnits = withItems.lineItems
    .filter((item) => item.product.kind === "BOOTH")
    .flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        dealId,
        productId: item.productId,
        finish: item.finish,
        finishDetails: item.finishDetails,
      })),
    );
  await prisma.$transaction([
    prisma.deal.update({ where: { id: deal.id }, data: { stage: "WON", dealId, wonAt: new Date() } }),
    prisma.boothUnit.createMany({ data: boothUnits }),
  ]);
  const units = await prisma.boothUnit.findMany({ where: { dealId } });
  console.log("Booth units created:", units.length);
  assert(units.length === 3, `expected 3 booth units (add-ons excluded), got ${units.length}`);

  // Ops File grouping (no sheet write — just verify grouping/suffixes/add-ons).
  const full = await prisma.deal.findUniqueOrThrow({
    where: { id: deal.id },
    include: { contacts: true, lineItems: { include: { product: true } } },
  });
  const groups = buildExportGroups(full);
  console.log(
    "Ops File rows:",
    groups.map(
      (g) =>
        `${dealId}${g.suffix}: model=${g.model || "(empty)"} booths=${g.quantity ?? "(empty)"} addons="${g.addOns.join(", ")}" amount=${g.amount.toFixed(2)}`,
    ),
  );
  assert(groups.length === 3, `expected 3 Ops File rows, got ${groups.length}`);
  const [sohoRow, camdenRow, addOnRow] = groups;
  assert(sohoRow.suffix === "" && camdenRow.suffix === "a" && addOnRow.suffix === "b", "suffixes should be '', a, b");
  assert(sohoRow.addOns.join(", ") === "2x Extra warranty", `soho row add-ons wrong: ${sohoRow.addOns.join(", ")}`);
  assert(sohoRow.amount === 2 * 4500 + 2 * 350, `soho row amount should include attached add-ons, got ${sohoRow.amount}`);
  assert(camdenRow.addOns.length === 0 && camdenRow.amount === 12500, "camden row should be unchanged");
  assert(addOnRow.model === "" && addOnRow.quantity === null, "standalone row must leave model/booths empty");
  assert(addOnRow.addOns.join(", ") === "Ergonomic chair" && addOnRow.amount === 420, "standalone row add-ons/amount wrong");

  // PDF render (attached add-on indented under its booth, standalone as row).
  const pdf = await renderToBuffer(QuotePdfDocument({ quote: full }));
  writeFileSync("/tmp/meavo-smoke-quote.pdf", pdf);
  console.log("PDF rendered:", pdf.length, "bytes -> /tmp/meavo-smoke-quote.pdf");

  // Client stats sanity: revenue over WON deals for this client.
  const clientWithDeals = await prisma.client.findUniqueOrThrow({
    where: { id: client.id },
    include: { deals: { include: { lineItems: true } } },
  });
  const revenue = clientWithDeals.deals
    .filter((d) => d.stage === "WON")
    .reduce((sum, d) => sum + d.lineItems.reduce((s, li) => s + li.quantity * Number(li.unitPrice), 0), 0);
  console.log("Client revenue:", revenue);
  assert(revenue === 2 * 4500 + 2 * 350 + 12500 + 420, `client revenue wrong: ${revenue}`);

  // Cleanup (deal cascade removes contacts/line items/booth units).
  await cleanup();
  const remaining = await prisma.boothUnit.count({ where: { dealId } });
  console.log("Cleanup done. Remaining booth units:", remaining);

  // Reset to a fresh sequence so the first real quote is MQ-00001.
  // (Only safe while no real quotes exist — remove once the tool is live.)
  const realQuotes = await prisma.deal.count();
  if (realQuotes === 0) {
    await prisma.$executeRawUnsafe(`SELECT setval('"SalesQuoteNumberSeq"', 1, false)`);
    console.log("Sequence reset — next quote will be MQ-00001");
  } else {
    console.log("Real quotes exist; sequence left untouched.");
  }

  console.log("SMOKE TEST PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
