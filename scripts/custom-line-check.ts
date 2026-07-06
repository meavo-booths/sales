/**
 * Smoke test for custom one-off quote lines (productId null + customName).
 * Creates a throwaway deal with a booth line and a custom line, verifies the
 * read path and the Ops File grouping, then cleans up.
 *
 * Run: npx tsx scripts/custom-line-check.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { buildExportGroups } from "../src/lib/ops-sheet-export";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function main() {
  const stamp = Date.now();
  const booth = await prisma.product.findFirst({ where: { kind: "BOOTH", isActive: true } });
  assert(booth !== null, "need at least one active booth product");

  const deal = await prisma.deal.create({
    data: {
      quoteNumber: `CUSTOM-CHECK-${stamp}`,
      dealDate: new Date(),
      clientName: `Custom Line Check ${stamp}`,
      clientType: "DIRECT",
      paymentTerms: "UPFRONT_100",
      lineItems: {
        create: [
          {
            productId: booth!.id,
            quantity: 2,
            unitPrice: new Prisma.Decimal("5000.00"),
            sortOrder: 0,
          },
          {
            customName: "Crane hire",
            quantity: 1,
            unitPrice: new Prisma.Decimal("350.00"),
            description: "One-off site cost",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  try {
    const loaded = await prisma.deal.findUniqueOrThrow({
      where: { id: deal.id },
      include: { lineItems: { include: { product: true } } },
    });
    const custom = loaded.lineItems.find((li) => !li.productId);
    assert(custom !== undefined, "custom line saved");
    assert(custom!.product === null, "custom line has no product");
    assert(custom!.customName === "Crane hire", "customName round-trips");
    console.log("Custom line saved and read back:", custom!.customName);

    const groups = buildExportGroups(loaded);
    assert(groups.length === 2, `expected booth row + standalone row, got ${groups.length}`);
    const standalone = groups.find((g) => g.model === "");
    assert(standalone !== undefined, "standalone ops row exists");
    assert(standalone!.addOns.includes("Crane hire"), "custom line listed in ops add-ons column");
    assert(standalone!.amount === 350, `custom amount in ops row, got ${standalone!.amount}`);
    const total = groups.reduce((sum, g) => sum + g.amount, 0);
    assert(total === 10350, `ops total matches quote total, got ${total}`);
    console.log("Ops File grouping OK:", JSON.stringify(groups.map((g) => ({ model: g.model, addOns: g.addOns, amount: g.amount }))));
  } finally {
    await prisma.deal.delete({ where: { id: deal.id } });
  }

  console.log("custom-line-check passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
