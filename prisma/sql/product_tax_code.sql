-- Product.taxCode: Sales-owned Zamp product tax code for US sales tax.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/product_tax_code.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "taxCode" TEXT NOT NULL DEFAULT '';
