-- Sales tool tables: Product, Deal, DealContact, QuoteLineItem, BoothUnit
-- plus the quote-number sequence (MQ-00001, ...).
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/sales_tool.sql --schema prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

DO $$ BEGIN
  CREATE TYPE "DealStage" AS ENUM ('QUOTE', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentTerms" AS ENUM ('UPFRONT_100', 'SPLIT_50_50', 'NET_30');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DealClientType" AS ENUM ('DIRECT', 'AGENCY', 'COWORKING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DealContactKind" AS ENUM ('MAIN', 'FINANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProductFinish" AS ENUM ('CUSTOM', 'WHITE_STOCK', 'BLACK_STOCK', 'LDF_COLOUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BoothUnitStatus" AS ENUM ('PLANNED', 'IN_PRODUCTION', 'IN_STORAGE', 'IN_TRANSIT', 'ASSEMBLED', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Concurrency-safe source for sequential quote numbers.
CREATE SEQUENCE IF NOT EXISTS "SalesQuoteNumberSeq" START 1;

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT,
  "listPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku");
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");

CREATE TABLE IF NOT EXISTS "Deal" (
  "id" TEXT NOT NULL,
  "quoteNumber" TEXT NOT NULL,
  "stage" "DealStage" NOT NULL DEFAULT 'QUOTE',
  "dealId" TEXT,
  "dealDate" DATE NOT NULL,
  "salesRep" TEXT NOT NULL DEFAULT '',
  "market" TEXT NOT NULL DEFAULT '',
  "clientName" TEXT NOT NULL,
  "registeredAddress" TEXT NOT NULL DEFAULT '',
  "vatNumber" TEXT NOT NULL DEFAULT '',
  "clientType" "DealClientType" NOT NULL DEFAULT 'DIRECT',
  "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'UPFRONT_100',
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paymentPoDate" DATE,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "notes" TEXT NOT NULL DEFAULT '',
  "wonAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "sheetRows" JSONB,
  "sheetSyncedAt" TIMESTAMP(3),
  "sheetSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Deal_quoteNumber_key" ON "Deal"("quoteNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_dealId_key" ON "Deal"("dealId");
CREATE INDEX IF NOT EXISTS "Deal_stage_idx" ON "Deal"("stage");
CREATE INDEX IF NOT EXISTS "Deal_dealDate_idx" ON "Deal"("dealDate");
CREATE INDEX IF NOT EXISTS "Deal_clientName_idx" ON "Deal"("clientName");

CREATE TABLE IF NOT EXISTS "DealContact" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "kind" "DealContactKind" NOT NULL DEFAULT 'MAIN',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DealContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealContact_dealId_idx" ON "DealContact"("dealId");

DO $$ BEGIN
  ALTER TABLE "DealContact"
    ADD CONSTRAINT "DealContact_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "QuoteLineItem" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "finish" "ProductFinish" NOT NULL DEFAULT 'WHITE_STOCK',
  "finishDetails" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuoteLineItem_dealId_idx" ON "QuoteLineItem"("dealId");
CREATE INDEX IF NOT EXISTS "QuoteLineItem_productId_idx" ON "QuoteLineItem"("productId");

DO $$ BEGIN
  ALTER TABLE "QuoteLineItem"
    ADD CONSTRAINT "QuoteLineItem_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuoteLineItem"
    ADD CONSTRAINT "QuoteLineItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BoothUnit" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "finish" "ProductFinish" NOT NULL DEFAULT 'WHITE_STOCK',
  "finishDetails" TEXT NOT NULL DEFAULT '',
  "location" TEXT NOT NULL DEFAULT '',
  "status" "BoothUnitStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoothUnit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BoothUnit_dealId_idx" ON "BoothUnit"("dealId");
CREATE INDEX IF NOT EXISTS "BoothUnit_status_idx" ON "BoothUnit"("status");
CREATE INDEX IF NOT EXISTS "BoothUnit_productId_idx" ON "BoothUnit"("productId");

DO $$ BEGIN
  ALTER TABLE "BoothUnit"
    ADD CONSTRAINT "BoothUnit_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("dealId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BoothUnit"
    ADD CONSTRAINT "BoothUnit_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
