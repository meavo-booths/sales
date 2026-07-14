-- Delivery type on deals/quotes (D&I, delivery only, kerbside, factory pickup).
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_delivery_type.sql --schema node_modules/@meavo/db/prisma/schema.prisma

CREATE TYPE "DeliveryType" AS ENUM ('DI', 'DELIVERY_ONLY', 'KERBSIDE', 'FACTORY_PICKUP');
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "deliveryType" "DeliveryType";
