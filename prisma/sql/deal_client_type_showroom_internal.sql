-- Add Showroom and Internal/Events to DealClientType.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_client_type_showroom_internal.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

DO $$ BEGIN
  ALTER TYPE "DealClientType" ADD VALUE 'SHOWROOM';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DealClientType" ADD VALUE 'INTERNAL_EVENTS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
