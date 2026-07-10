-- Xero integration: invoice/item/contact links + admin-confirmed mappings.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/xero_integration.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroInvoiceId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroInvoiceNumber" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroSyncedAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "xeroSyncError" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_xeroInvoiceId_key" ON "Deal"("xeroInvoiceId");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "xeroItemId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "xeroItemCode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "xeroSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_xeroItemId_key" ON "Product"("xeroItemId");

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "xeroContactId" TEXT;

CREATE TABLE IF NOT EXISTS "XeroMarketThemeMapping" (
    "market" TEXT NOT NULL,
    "brandingThemeId" TEXT NOT NULL,
    "brandingThemeName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroMarketThemeMapping_pkey" PRIMARY KEY ("market")
);

CREATE TABLE IF NOT EXISTS "XeroMarketTaxMapping" (
    "market" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "taxName" TEXT NOT NULL DEFAULT '',
    "taxRate" DECIMAL(6,3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroMarketTaxMapping_pkey" PRIMARY KEY ("market")
);

CREATE TABLE IF NOT EXISTS "XeroIntegrationSettings" (
    "id" TEXT NOT NULL DEFAULT 'xero',
    "setupConfirmedAt" TIMESTAMP(3),
    "defaultBrandingThemeId" TEXT,
    "defaultBrandingThemeName" TEXT,
    "defaultTaxType" TEXT,
    "lastXeroItemsSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XeroIntegrationSettings_pkey" PRIMARY KEY ("id")
);
