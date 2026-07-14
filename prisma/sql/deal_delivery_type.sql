-- Delivery type on deals/quotes (D&I, delivery only, kerbside, factory pickup).
--
-- Targeted migration for the shared Neon database. Apply from meavo-sales with project Prisma 6:
--   cd /path/to/meavo-sales
--   npx prisma db execute --file prisma/sql/deal_delivery_type.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Do not run from ~ with global Prisma 7 — use the project's npx prisma (6.x) so --schema works.

DO $$ BEGIN
  CREATE TYPE "DeliveryType" AS ENUM ('DI', 'DELIVERY_ONLY', 'KERBSIDE', 'FACTORY_PICKUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "deliveryType" "DeliveryType";
