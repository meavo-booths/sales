-- Per-market Xero revenue account mapping.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/xero_accounts.sql --schema node_modules/@meavo/db/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "XeroMarketAccountMapping" (
    "market" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroMarketAccountMapping_pkey" PRIMARY KEY ("market")
);

ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultAccountCode" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultAccountName" TEXT;
