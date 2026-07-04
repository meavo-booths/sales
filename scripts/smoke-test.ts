/**
 * End-to-end smoke test for the core flow, run directly against the DB:
 * quote creation (sequence number) -> conversion (booth units) -> PDF render.
 * Cleans up after itself and resets the quote-number sequence.
 *
 * Run: npx tsx scripts/smoke-test.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { QuotePdfDocument } from "../src/lib/quote-pdf";
import { buildExportGroups } from "../src/lib/ops-sheet-export";

const prisma = new PrismaClient();

async function main() {
  // Clean up any deals left behind by previous failed runs.
  await prisma.deal.deleteMany({ where: { clientName: "Smoke Test GmbH" } });

  const next = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT nextval('"SalesQuoteNumberSeq"') AS n
  `;
  const quoteNumber = `MQ-${String(Number(next[0].n)).padStart(5, "0")}`;
  console.log("Quote number:", quoteNumber);

  const [soho, camden] = await Promise.all([
    prisma.product.findUniqueOrThrow({ where: { sku: "MEAVO-SOHO" } }),
    prisma.product.findUniqueOrThrow({ where: { sku: "MEAVO-CAMDEN-4" } }),
  ]);

  const deal = await prisma.deal.create({
    data: {
      quoteNumber,
      dealDate: new Date(),
      salesRep: "Smoke Test",
      market: "Germany",
      clientName: "Smoke Test GmbH",
      registeredAddress: "Teststrasse 1, Berlin",
      vatNumber: "DE123456789",
      clientType: "DIRECT",
      paymentTerms: "SPLIT_50_50",
      notes: "smoke test — will be deleted",
      contacts: {
        create: [
          { kind: "MAIN", name: "Max Mustermann", email: "max@example.com", role: "Office manager" },
          { kind: "FINANCE", name: "Erika Musterfrau", email: "ap@example.com" },
        ],
      },
      lineItems: {
        create: [
          { productId: soho.id, quantity: 2, unitPrice: new Prisma.Decimal("4500.00"), finish: "WHITE_STOCK", sortOrder: 0 },
          { productId: camden.id, quantity: 1, unitPrice: new Prisma.Decimal("12500.00"), finish: "CUSTOM", finishDetails: "RAL 7016", sortOrder: 1 },
        ],
      },
    },
    include: { contacts: true, lineItems: { include: { product: true } } },
  });
  console.log("Created deal:", deal.id, "contacts:", deal.contacts.length, "items:", deal.lineItems.length);

  // Convert (mirrors convertQuoteAction without auth)
  const dealId = `SMOKE-${Date.now()}`;
  const boothUnits = deal.lineItems.flatMap((item) =>
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
  console.log("Booth units created:", units.length, "statuses:", [...new Set(units.map((u) => u.status))]);

  // Ops File grouping (no sheet configured — just verify grouping/suffixes)
  const full = await prisma.deal.findUniqueOrThrow({
    where: { id: deal.id },
    include: { contacts: true, lineItems: { include: { product: true } } },
  });
  const groups = buildExportGroups(full);
  console.log(
    "Ops File rows:",
    groups.map((g) => `${dealId}${g.suffix}: ${g.quantity}x ${g.model} = ${g.amount.toFixed(2)}`),
  );

  // PDF render
  const pdf = await renderToBuffer(QuotePdfDocument({ quote: full }));
  writeFileSync("/tmp/meavo-smoke-quote.pdf", pdf);
  console.log("PDF rendered:", pdf.length, "bytes -> /tmp/meavo-smoke-quote.pdf");

  // Cleanup (cascades contacts, line items, booth units)
  await prisma.deal.delete({ where: { id: deal.id } });
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
