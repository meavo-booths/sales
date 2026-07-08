-- Per-product list price currency.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/product_currency.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';

UPDATE "Product" SET "currency" = 'EUR' WHERE "currency" IS NULL OR "currency" = '';
