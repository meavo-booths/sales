-- Deal assembly fields: install address + ready-to-assemble flag.
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_assembly_fields.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "assemblyAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "readyToAssemble" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Deal_readyToAssemble_idx" ON "Deal"("readyToAssemble");
