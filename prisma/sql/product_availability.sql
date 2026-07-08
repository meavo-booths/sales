-- Product market + client-type availability (join table).
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/product_availability.sql --schema node_modules/@meavo/db/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "ProductAvailability" (
  "productId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "clientType" "DealClientType" NOT NULL,

  CONSTRAINT "ProductAvailability_pkey" PRIMARY KEY ("productId", "market", "clientType")
);

CREATE INDEX IF NOT EXISTS "ProductAvailability_market_clientType_idx"
  ON "ProductAvailability"("market", "clientType");

DO $$ BEGIN
  ALTER TABLE "ProductAvailability"
    ADD CONSTRAINT "ProductAvailability_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
