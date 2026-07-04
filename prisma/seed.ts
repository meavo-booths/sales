import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Booth models mirrored from the assembly app's BoothModel enum. */
const PRODUCTS: { name: string; sku: string; description: string }[] = [
  { name: "Soho", sku: "MEAVO-SOHO", description: "One-person phone booth" },
  { name: "Workstation", sku: "MEAVO-WORKSTATION", description: "One-person work booth" },
  { name: "Camden 2", sku: "MEAVO-CAMDEN-2", description: "Two-person meeting booth" },
  { name: "Camden 4", sku: "MEAVO-CAMDEN-4", description: "Four-person meeting booth" },
  { name: "Haven One", sku: "MEAVO-HAVEN-ONE", description: "One-person phone booth" },
  { name: "Haven Focus", sku: "MEAVO-HAVEN-FOCUS", description: "One-person focus booth" },
  { name: "Haven 2", sku: "MEAVO-HAVEN-2", description: "Two-person meeting booth" },
  { name: "Haven 4", sku: "MEAVO-HAVEN-4", description: "Four-person meeting booth" },
];

async function main() {
  await prisma.$executeRawUnsafe('CREATE SEQUENCE IF NOT EXISTS "SalesQuoteNumberSeq" START 1');

  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      create: product,
      update: {},
    });
  }

  console.log(`Seeded ${PRODUCTS.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
