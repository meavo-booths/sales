-- Custom one-off quote lines: productId becomes optional, the item name for
-- custom lines lives in customName.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/custom_line_items.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

ALTER TABLE "QuoteLineItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "QuoteLineItem" ADD COLUMN IF NOT EXISTS "customName" TEXT NOT NULL DEFAULT '';
