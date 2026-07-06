-- Add-on / booth compatibility restrictions.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/addon_restrictions.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

CREATE TABLE IF NOT EXISTS "ProductAddOnRestriction" (
  "addOnId" TEXT NOT NULL,
  "boothId" TEXT NOT NULL,

  CONSTRAINT "ProductAddOnRestriction_pkey" PRIMARY KEY ("addOnId", "boothId")
);

CREATE INDEX IF NOT EXISTS "ProductAddOnRestriction_boothId_idx"
  ON "ProductAddOnRestriction"("boothId");

DO $$ BEGIN
  ALTER TABLE "ProductAddOnRestriction"
    ADD CONSTRAINT "ProductAddOnRestriction_addOnId_fkey"
    FOREIGN KEY ("addOnId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAddOnRestriction"
    ADD CONSTRAINT "ProductAddOnRestriction_boothId_fkey"
    FOREIGN KEY ("boothId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
