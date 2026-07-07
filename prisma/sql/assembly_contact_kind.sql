-- Add Assembly as a third deal/client contact kind.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/assembly_contact_kind.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from an app repo.

ALTER TYPE "DealContactKind" ADD VALUE IF NOT EXISTS 'ASSEMBLY';
