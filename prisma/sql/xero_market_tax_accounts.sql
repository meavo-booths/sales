-- International per-market tax liability account mappings (reference only).
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/xero_market_tax_accounts.sql --schema node_modules/@meavo/db/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "XeroMarketTaxAccountMapping" (
    "market" TEXT NOT NULL,
    "taxAccountCode" TEXT NOT NULL,
    "taxAccountName" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroMarketTaxAccountMapping_pkey" PRIMARY KEY ("market")
);

ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultTaxAccountCode" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultTaxAccountName" TEXT;
