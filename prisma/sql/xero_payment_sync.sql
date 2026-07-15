-- Payment status sync from Xero (locks manual edits after first poll).
--
-- Apply from meavo-sales:
--   npx prisma db execute --file prisma/sql/xero_payment_sync.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroPaymentSyncedAt" TIMESTAMPTZ;
