-- Deal US ship-to address, Zamp tax amounts, and sync bookkeeping.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_us_tax.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "shipToLine1" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "shipToLine2" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "shipToCity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "shipToZip" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "usTaxAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "usTaxDetail" JSONB;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "zampTransactionId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "zampSyncedAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "zampSyncError" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Deal_zampTransactionId_key" ON "Deal"("zampTransactionId");
