-- Multi-currency quote FX fields for EUR reporting.
--
-- Apply with:
--   npx prisma db execute --file prisma/sql/quote_fx.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "exchangeRateToEur" DECIMAL(18,8);

ALTER TABLE "QuoteLineItem" ADD COLUMN IF NOT EXISTS "unitPriceEur" DECIMAL(12,2);

-- Backfill EUR equivalents for existing EUR deals.
UPDATE "QuoteLineItem" li
SET "unitPriceEur" = li."unitPrice"
FROM "Deal" d
WHERE d.id = li."dealId"
  AND d.currency = 'EUR'
  AND li."unitPriceEur" IS NULL;

UPDATE "Deal"
SET "exchangeRateToEur" = 1
WHERE currency = 'EUR' AND "exchangeRateToEur" IS NULL;
