-- Product families and family-based add-on compatibility.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/product_families.sql --schema node_modules/@meavo/db/prisma/schema.prisma

DO $$ BEGIN
  CREATE TYPE "BoothProductFamily" AS ENUM (
    'SOHO',
    'WORKSTATION',
    'CAMDEN_2',
    'CAMDEN_4',
    'HAVEN_ONE',
    'HAVEN_FOCUS',
    'HAVEN_2',
    'HAVEN_4'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AddOnProductFamily" AS ENUM (
    'BAR_STOOL',
    'OFFICE_CHAIR',
    'MONITOR',
    'MONITOR_WITH_CAMERA',
    'WARRANTY',
    'ASSEMBLY',
    'MOVING_SERVICE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "boothFamily" "BoothProductFamily";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "addOnFamily" "AddOnProductFamily";

-- Backfill booth families from legacy product names.
UPDATE "Product" SET "boothFamily" = 'SOHO' WHERE "name" = 'Soho' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'WORKSTATION' WHERE "name" = 'Workstation' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'CAMDEN_2' WHERE "name" = 'Camden 2' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'CAMDEN_4' WHERE "name" = 'Camden 4' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'HAVEN_ONE' WHERE "name" = 'Haven One' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'HAVEN_FOCUS' WHERE "name" = 'Haven Focus' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'HAVEN_2' WHERE "name" = 'Haven 2' AND "boothFamily" IS NULL;
UPDATE "Product" SET "boothFamily" = 'HAVEN_4' WHERE "name" = 'Haven 4' AND "boothFamily" IS NULL;

CREATE TABLE IF NOT EXISTS "ProductAddOnFamilyRestriction" (
  "addOnId" TEXT NOT NULL,
  "boothFamily" "BoothProductFamily" NOT NULL,

  CONSTRAINT "ProductAddOnFamilyRestriction_pkey" PRIMARY KEY ("addOnId", "boothFamily")
);

CREATE INDEX IF NOT EXISTS "ProductAddOnFamilyRestriction_boothFamily_idx"
  ON "ProductAddOnFamilyRestriction"("boothFamily");

DO $$ BEGIN
  ALTER TABLE "ProductAddOnFamilyRestriction"
    ADD CONSTRAINT "ProductAddOnFamilyRestriction_addOnId_fkey"
    FOREIGN KEY ("addOnId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Product_boothFamily_idx" ON "Product"("boothFamily");
CREATE INDEX IF NOT EXISTS "Product_addOnFamily_idx" ON "Product"("addOnFamily");

DROP TABLE IF EXISTS "ProductAddOnRestriction";
