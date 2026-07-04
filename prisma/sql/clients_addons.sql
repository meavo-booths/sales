-- Clients directory + product add-ons.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/clients_addons.sql --schema prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

DO $$ BEGIN
  CREATE TYPE "ProductKind" AS ENUM ('BOOTH', 'ADDON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "kind" "ProductKind" NOT NULL DEFAULT 'BOOTH';
CREATE INDEX IF NOT EXISTS "Product_kind_idx" ON "Product"("kind");

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "registeredAddress" TEXT NOT NULL DEFAULT '',
  "vatNumber" TEXT NOT NULL DEFAULT '',
  "clientType" "DealClientType" NOT NULL DEFAULT 'DIRECT',
  "market" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "isVip" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Client_name_idx" ON "Client"("name");

CREATE TABLE IF NOT EXISTS "ClientContact" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kind" "DealContactKind" NOT NULL DEFAULT 'MAIN',
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientContact_clientId_idx" ON "ClientContact"("clientId");

DO $$ BEGIN
  ALTER TABLE "ClientContact"
    ADD CONSTRAINT "ClientContact_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE INDEX IF NOT EXISTS "Deal_clientId_idx" ON "Deal"("clientId");

DO $$ BEGIN
  ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "QuoteLineItem" ADD COLUMN IF NOT EXISTS "parentLineItemId" TEXT;
CREATE INDEX IF NOT EXISTS "QuoteLineItem_parentLineItemId_idx" ON "QuoteLineItem"("parentLineItemId");

DO $$ BEGIN
  ALTER TABLE "QuoteLineItem"
    ADD CONSTRAINT "QuoteLineItem_parentLineItemId_fkey"
    FOREIGN KEY ("parentLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
