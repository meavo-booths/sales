/**
 * Quick check for ProductAddOnFamilyRestriction: create a restricted add-on,
 * verify the relation reads back, then clean up.
 *
 * Run: npx tsx --env-file=.env scripts/addon-restriction-check.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany({ where: { version: "SMOKE-ADDON-RESTRICTED" } });

  const booth = await prisma.product.findFirstOrThrow({ where: { kind: "BOOTH", boothFamily: { not: null } } });
  if (!booth.boothFamily) throw new Error("booth product missing boothFamily");

  const addOn = await prisma.product.create({
    data: {
      name: "Restricted add-on",
      version: "SMOKE-ADDON-RESTRICTED",
      kind: "ADDON",
      addOnFamily: "WARRANTY",
      listPrice: new Prisma.Decimal("100.00"),
      familyRestrictions: { create: [{ boothFamily: booth.boothFamily }] },
    },
    include: { familyRestrictions: true },
  });
  console.log("Created add-on restricted to:", booth.boothFamily, addOn.familyRestrictions);

  const readBack = await prisma.productAddOnFamilyRestriction.findMany({
    where: { addOnId: addOn.id },
  });
  if (!readBack.some((r) => r.boothFamily === booth.boothFamily)) {
    throw new Error("family restriction did not read back");
  }
  console.log("Family restriction reads back OK");

  // Cascade check: deleting the add-on removes the restriction rows.
  await prisma.product.delete({ where: { id: addOn.id } });
  const remaining = await prisma.productAddOnFamilyRestriction.count({
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
