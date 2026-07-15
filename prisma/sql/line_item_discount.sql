-- Per-line discounts on quote line items (fixed amount or percentage off list unit price).
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/line_item_discount.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

DO $$ BEGIN
  CREATE TYPE "LineItemDiscountType" AS ENUM ('NONE', 'FIXED', 'PERCENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "QuoteLineItem"
  ADD COLUMN IF NOT EXISTS "discountType" "LineItemDiscountType" NOT NULL DEFAULT 'NONE';

ALTER TABLE "QuoteLineItem"
  ADD COLUMN IF NOT EXISTS "discountValue" DECIMAL(12, 2) NOT NULL DEFAULT 0;
