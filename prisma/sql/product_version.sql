-- Rename Product.sku to version and drop unique constraint.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/product_version.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Product" RENAME COLUMN "sku" TO "version";

DROP INDEX IF EXISTS "Product_sku_key";

CREATE INDEX IF NOT EXISTS "Product_version_idx" ON "Product"("version");
