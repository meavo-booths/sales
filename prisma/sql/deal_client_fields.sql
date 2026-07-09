-- Deal client PO, actual client, and website snapshot fields.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/deal_client_fields.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "clientPo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "actualClient" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "website" TEXT NOT NULL DEFAULT '';
