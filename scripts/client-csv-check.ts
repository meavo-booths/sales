/**
 * Smoke check for client CSV bulk upload (parent + normal modes).
 * Synthetic data only; cleans up after itself.
 *
 * Run: npx tsx --env-file=.env scripts/client-csv-check.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  applyClientCsvImport,
  previewClientCsvImport,
} from "../src/lib/clients/csv-import";

const PREFIX = "SMOKE-CSV-";

async function cleanup() {
  await prisma.client.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
}

async function main() {
  await cleanup();

  // --- Parent upload ---
  const parentCsv = [
    "Parent Company Name,Market,Client Type",
    `${PREFIX}Parent A,UK,Direct`,
    `${PREFIX}Parent A,Germany,Agency`, // duplicate in file → skip
    `${PREFIX}Parent B,Multi-market,Agency`,
    `${PREFIX}Bad,Atlantis,Direct`, // bad market → error
  ].join("\n");

  const parentPreview = await previewClientCsvImport("parent", parentCsv);
  if (!parentPreview.canImport) throw new Error("parent preview should be importable");
  if (parentPreview.okCount !== 2) {
    throw new Error(`expected 2 ok parents, got ${parentPreview.okCount}`);
  }
  if (parentPreview.skippedCount !== 1) {
    throw new Error(`expected 1 skipped parent, got ${parentPreview.skippedCount}`);
  }
  if (parentPreview.errorCount !== 1) {
    throw new Error(`expected 1 error parent, got ${parentPreview.errorCount}`);
  }

  const parentApply = await applyClientCsvImport("parent", parentCsv);
  if (parentApply.created !== 2) {
    throw new Error(`expected 2 parents created, got ${parentApply.created}`);
  }
  console.log("Parent CSV preview + apply OK");

  // Re-import same parents → all skipped, canImport false
  const parentAgain = await previewClientCsvImport("parent", [
    "Parent Company Name,Market,Client Type",
    `${PREFIX}Parent A,UK,Direct`,
  ].join("\n"));
  if (parentAgain.canImport) throw new Error("duplicate-only file should not be importable");
  if (parentAgain.skippedCount !== 1) throw new Error("expected skip for existing parent");
  console.log("Duplicate parent skipped OK");

  // --- Normal upload ---
  const normalCsv = [
    "Company Name,Company URL,Client Type,Market,Parent Company",
    `${PREFIX}Child 1,https://a.example,Direct,UK,${PREFIX}Parent A`,
    `${PREFIX}Child 2,https://b.example,Co-working,Germany,`, // no parent
    `${PREFIX}Child 1,https://dup.example,Agency,US,${PREFIX}Parent A`, // dup in file
    `${PREFIX}Orphan,https://c.example,Direct,UK,No Such Parent`, // missing parent
  ].join("\n");

  const normalPreview = await previewClientCsvImport("normal", normalCsv);
  if (!normalPreview.canImport) throw new Error("normal preview should be importable");
  if (normalPreview.okCount !== 2) {
    throw new Error(`expected 2 ok normals, got ${normalPreview.okCount}: ${JSON.stringify(normalPreview.rows)}`);
  }
  if (normalPreview.skippedCount !== 1) {
    throw new Error(`expected 1 skipped normal, got ${normalPreview.skippedCount}`);
  }
  if (normalPreview.errorCount !== 1) {
    throw new Error(`expected 1 error normal, got ${normalPreview.errorCount}`);
  }

  const child1 = normalPreview.rows.find((r) => r.name === `${PREFIX}Child 1` && r.status === "ok");
  if (!child1?.create?.parentClientId) throw new Error("Child 1 should resolve parent id");

  const normalApply = await applyClientCsvImport("normal", normalCsv);
  if (normalApply.created !== 2) {
    throw new Error(`expected 2 normals created, got ${normalApply.created}`);
  }

  const linked = await prisma.client.findFirst({
    where: { name: `${PREFIX}Child 1` },
    select: { parentClientId: true, website: true, parent: { select: { name: true } } },
  });
  if (!linked?.parentClientId || linked.parent?.name !== `${PREFIX}Parent A`) {
    throw new Error("Child 1 not linked to Parent A");
  }
  if (linked.website !== "https://a.example") throw new Error("website not saved");

  const standalone = await prisma.client.findFirst({
    where: { name: `${PREFIX}Child 2` },
    select: { parentClientId: true },
  });
  if (standalone?.parentClientId) throw new Error("Child 2 should be standalone");

  console.log("Normal CSV preview + apply + parent link OK");

  await cleanup();
  console.log("Client CSV smoke check passed ✔");
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
