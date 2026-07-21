/**
 * Smoke check for the Deal change audit log (DealAuditLog). Verifies that a
 * real field edit is captured with a field-level diff, and that a pure
 * integration sync-field write (as the Ops/Xero/Zamp exporters do) writes no
 * audit row. Synthetic data only; cleans up after itself.
 *
 * Run: npx tsx --env-file=.env scripts/audit-log-check.ts
 */
import { prisma } from "../src/lib/prisma";
import { setActorUserId } from "../src/lib/request-context";

const DEAL_ID = "SMOKE-AUDIT-DEAL";
const QUOTE_NUMBER = "SMOKE-AUDIT-QUOTE";
const ACTOR = "smoke-audit-user";

async function cleanup() {
  const deal = await prisma.deal.findUnique({ where: { quoteNumber: QUOTE_NUMBER } });
  if (deal) {
    // Cascade removes DealAuditLog rows with the deal.
    await prisma.deal.delete({ where: { id: deal.id } });
  }
}

async function main() {
  await cleanup();
  setActorUserId(ACTOR);

  const deal = await prisma.deal.create({
    data: {
      quoteNumber: QUOTE_NUMBER,
      stage: "QUOTE",
      dealDate: new Date("2026-07-06"),
      clientName: "Smoke Audit Client",
      salesRep: "Alice",
    },
  });

  // 1) A real attribute edit should be captured with a diff.
  await prisma.deal.update({ where: { id: deal.id }, data: { salesRep: "Bob" } });

  const afterEdit = await prisma.dealAuditLog.findMany({
    where: { dealId: deal.id, action: "UPDATE" },
    orderBy: { createdAt: "asc" },
  });
  const salesRepChange = afterEdit
    .flatMap((row) => row.changes as Array<{ field: string; before: unknown; after: unknown }>)
    .find((change) => change.field === "salesRep");
  if (!salesRepChange) throw new Error("expected an UPDATE audit row for salesRep");
  if (salesRepChange.before !== "Alice" || salesRepChange.after !== "Bob") {
    throw new Error(
      `salesRep diff wrong: ${JSON.stringify(salesRepChange.before)} -> ${JSON.stringify(salesRepChange.after)}`,
    );
  }
  const updateRow = afterEdit.find((row) =>
    (row.changes as Array<{ field: string }>).some((c) => c.field === "salesRep"),
  );
  if (updateRow?.actorUserId !== ACTOR) {
    throw new Error(`expected actorUserId ${ACTOR}, got ${String(updateRow?.actorUserId)}`);
  }
  console.log("Attribute edit captured with actor + before/after diff OK");

  // 2) A pure sync-field write should NOT create an audit row.
  const beforeSyncCount = await prisma.dealAuditLog.count({ where: { dealId: deal.id } });
  await prisma.deal.update({
    where: { id: deal.id },
    data: { xeroSyncedAt: new Date(), xeroSyncError: null, sheetSyncedAt: new Date() },
  });
  const afterSyncCount = await prisma.dealAuditLog.count({ where: { dealId: deal.id } });
  if (afterSyncCount !== beforeSyncCount) {
    throw new Error(
      `sync-field write should not be audited (had ${beforeSyncCount}, now ${afterSyncCount})`,
    );
  }
  console.log("Integration sync-field write produced no audit noise OK");

  await cleanup();
  console.log("Audit log smoke check passed ✔");
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
