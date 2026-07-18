-- Lost reason on Deal when a quote is marked LOST.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_lost_reason.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

DO $$ BEGIN
  CREATE TYPE "LostReason" AS ENUM (
    'PROJECT_CANCELLED',
    'CHOSE_COMPETITOR',
    'PRICE_TOO_HIGH',
    'NO_REPLY',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "lostReason" "LostReason";

ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "lostReasonNote" TEXT NOT NULL DEFAULT '';
