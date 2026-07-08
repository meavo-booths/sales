import { PrismaClient, type BoothProductFamily } from "@prisma/client";

const prisma = new PrismaClient();

const PRODUCTS: {
  name: string;
  version: string;
  boothFamily: BoothProductFamily;
  description: string;
}[] = [
  { name: "Soho", version: "MEAVO-SOHO", boothFamily: "SOHO", description: "One-person phone booth" },
  {
    name: "Workstation",
    version: "MEAVO-WORKSTATION",
    boothFamily: "WORKSTATION",
    description: "One-person work booth",
  },
  {
    name: "Camden 2",
    version: "MEAVO-CAMDEN-2",
    boothFamily: "CAMDEN_2",
    description: "Two-person meeting booth",
  },
  {
    name: "Camden 4",
    version: "MEAVO-CAMDEN-4",
    boothFamily: "CAMDEN_4",
    description: "Four-person meeting booth",
  },
  {
    name: "Haven One",
    version: "MEAVO-HAVEN-ONE",
    boothFamily: "HAVEN_ONE",
    description: "One-person phone booth",
  },
  {
    name: "Haven Focus",
    version: "MEAVO-HAVEN-FOCUS",
    boothFamily: "HAVEN_FOCUS",
    description: "One-person focus booth",
  },
  {
    name: "Haven 2",
    version: "MEAVO-HAVEN-2",
    boothFamily: "HAVEN_2",
    description: "Two-person meeting booth",
  },
  {
    name: "Haven 4",
    version: "MEAVO-HAVEN-4",
    boothFamily: "HAVEN_4",
    description: "Four-person meeting booth",
  },
];

async function main() {
  await prisma.$executeRawUnsafe('CREATE SEQUENCE IF NOT EXISTS "SalesQuoteNumberSeq" START 1');

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: product.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          version: product.version,
          boothFamily: product.boothFamily,
          description: product.description,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          version: product.version,
          boothFamily: product.boothFamily,
          description: product.description,
        },
      });
    }
  }

  console.log(`Seeded ${PRODUCTS.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
