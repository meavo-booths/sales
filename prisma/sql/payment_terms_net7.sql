-- Add NET_7 payment terms and migrate existing Net 30 deals.
--
-- Apply from meavo-sales in TWO steps (Postgres requires enum values to be
-- committed before use in UPDATE):
--   npx prisma db execute --file prisma/sql/payment_terms_net7_add_enum.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--   npx prisma db execute --file prisma/sql/payment_terms_net7.sql --schema node_modules/@meavo/db/prisma/schema.prisma

UPDATE "Deal"
SET "paymentTerms" = 'NET_7'
WHERE "paymentTerms" = 'NET_30';
