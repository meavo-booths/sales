-- Socket type and target delivery date on deals/quotes.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_socket_target_delivery.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "socketType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "targetDeliveryDate" DATE;
