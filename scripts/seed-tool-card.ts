import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const card = await prisma.toolCard.upsert({
    where: { id: "seed-sales-tool" },
    update: {
      name: "Sales",
      description: "Generate quotes and convert them into won deals.",
      url: "https://sales.meavo.app",
      iconKey: "handover",
      kind: "APP_ACCESS",
      linkedAppKey: "sales",
      sortOrder: 2,
      isActive: true,
    },
    create: {
      id: "seed-sales-tool",
      name: "Sales",
      description: "Generate quotes and convert them into won deals.",
      url: "https://sales.meavo.app",
      iconKey: "handover",
      kind: "APP_ACCESS",
      linkedAppKey: "sales",
      sortOrder: 2,
      isActive: true,
    },
  });
  console.log("Seeded tool card:", card.id);

  const admins = await prisma.user.findMany({ where: { systemRole: "ADMIN" }, select: { id: true, email: true } });
  for (const admin of admins) {
    await prisma.toolCardAccess.upsert({
      where: { userId_cardId: { userId: admin.id, cardId: card.id } },
      update: {},
      create: { userId: admin.id, cardId: card.id },
    });
    console.log("Granted access:", admin.email);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
