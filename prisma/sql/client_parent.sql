-- Parent company hierarchy on Client (two levels: group head → subsidiaries).
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/client_parent.sql --schema node_modules/@meavo/db/prisma/schema.prisma

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "parentClientId" TEXT;
CREATE INDEX IF NOT EXISTS "Client_parentClientId_idx" ON "Client"("parentClientId");

DO $$ BEGIN
  ALTER TABLE "Client"
    ADD CONSTRAINT "Client_parentClientId_fkey"
    FOREIGN KEY ("parentClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
