-- Step 1 of 2: add NET_7 to PaymentTerms enum.
-- Run payment_terms_net7.sql immediately after (separate transaction).
--
--   npx prisma db execute --file prisma/sql/payment_terms_net7_add_enum.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TYPE "PaymentTerms" ADD VALUE IF NOT EXISTS 'NET_7';
