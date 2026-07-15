-- Final Xero invoice tracking (50/50) and skip-Xero-on-win flag.
--
-- Apply from meavo-sales:
--   npx prisma db execute --file prisma/sql/xero_final_invoice.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroFinalInvoiceId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroFinalInvoiceNumber" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroFinalSyncedAt" TIMESTAMPTZ;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroFinalSyncError" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "skipXeroOnWin" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Deal_xeroFinalInvoiceId_key" ON "Deal" ("xeroFinalInvoiceId");
