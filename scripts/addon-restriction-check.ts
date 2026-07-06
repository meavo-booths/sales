/**
 * Quick check for ProductAddOnRestriction: create a restricted add-on,
 * verify the relation reads back, then clean up.
 *
 * Run: npx tsx --env-file=.env scripts/addon-restriction-check.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany({ where: { sku: "SMOKE-ADDON-RESTRICTED" } });

  const booth = await prisma.product.findFirstOrThrow({ where: { kind: "BOOTH" } });

  const addOn = await prisma.product.create({
    data: {
      name: "Restricted add-on",
      sku: "SMOKE-ADDON-RESTRICTED",
      kind: "ADDON",
      listPrice: new Prisma.Decimal("100.00"),
      addOnRestrictions: { create: [{ boothId: booth.id }] },
    },
    include: { addOnRestrictions: true },
  });
  console.log("Created add-on restricted to:", booth.name, addOn.addOnRestrictions);

  const fromBoothSide = await prisma.product.findUniqueOrThrow({
    where: { id: booth.id },
    include: { boothAddOns: { include: { addOn: { select: { sku: true } } } } },
  });
  if (!fromBoothSide.boothAddOns.some((r) => r.addOn.sku === "SMOKE-ADDON-RESTRICTED")) {
    throw new Error("booth-side relation did not read back");
  }
  console.log("Booth-side relation reads back OK");

  // Cascade check: deleting the add-on removes the restriction rows.
  await prisma.product.delete({ where: { id: addOn.id } });
  const remaining = await prisma.productAddOnRestriction.count({
    where: { addOnId: addOn.id },
  });
  if (remaining !== 0) throw new Error(`expected 0 remaining restrictions, got ${remaining}`);
  console.log("Cascade cleanup OK. RESTRICTION CHECK PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
