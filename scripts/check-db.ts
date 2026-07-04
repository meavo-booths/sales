import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('Deal','DealContact','Product','QuoteLineItem','BoothUnit')`,
  );
  console.log("sales tables:", tables.map((t) => t.table_name).sort().join(", ") || "MISSING");

  const products = await prisma.product.count();
  console.log("products:", products);

  const seq = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'SalesQuoteNumberSeq') AS exists`,
  );
  console.log("quote sequence:", seq[0].exists);

  const card = await prisma.toolCard.findUnique({ where: { id: "seed-sales-tool" } });
  console.log("sales tool card:", card ? `${card.name} (${card.url})` : "MISSING");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
