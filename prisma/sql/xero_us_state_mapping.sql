-- Per-US-state Xero mappings + US defaults on integration settings.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/xero_us_state_mapping.sql --schema node_modules/@meavo/db/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "XeroUsStateMapping" (
    "state" TEXT NOT NULL,
    "brandingThemeId" TEXT NOT NULL DEFAULT '',
    "brandingThemeName" TEXT NOT NULL DEFAULT '',
    "accountCode" TEXT NOT NULL DEFAULT '',
    "accountName" TEXT NOT NULL DEFAULT '',
    "taxType" TEXT NOT NULL DEFAULT '',
    "taxName" TEXT NOT NULL DEFAULT '',
    "taxRate" DECIMAL(6,3),
    "taxAccountCode" TEXT NOT NULL DEFAULT '',
    "taxAccountName" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroUsStateMapping_pkey" PRIMARY KEY ("state")
);

ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "usSetupConfirmedAt" TIMESTAMP(3);
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsBrandingThemeId" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsBrandingThemeName" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsAccountCode" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsAccountName" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsTaxType" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsTaxAccountCode" TEXT;
ALTER TABLE "XeroIntegrationSettings" ADD COLUMN IF NOT EXISTS "defaultUsTaxAccountName" TEXT;

-- US market rows are configured per-state on /settings/xero/us.
DELETE FROM "XeroMarketThemeMapping" WHERE "market" = 'US';
DELETE FROM "XeroMarketTaxMapping" WHERE "market" = 'US';
DELETE FROM "XeroMarketAccountMapping" WHERE "market" = 'US';
