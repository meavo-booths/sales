-- Field-level change history for Deal rows (sales app).
--
-- Targeted migration for the shared Neon database. Apply with:
--   npx prisma db execute --file prisma/sql/deal_audit_log.sql --schema node_modules/@meavo/db/prisma/schema.prisma
--
-- Never run a bare `prisma db push` from a repo whose schema is behind the
-- other apps — it may try to drop their tables.

CREATE TABLE IF NOT EXISTS "DealAuditLog" (
  "id"          TEXT NOT NULL,
  "dealId"      TEXT NOT NULL,
  "actorUserId" TEXT,
  "action"      TEXT NOT NULL,
  "changes"     JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealAuditLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "DealAuditLog"
    ADD CONSTRAINT "DealAuditLog_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "DealAuditLog_dealId_createdAt_idx"
  ON "DealAuditLog" ("dealId", "createdAt");

CREATE INDEX IF NOT EXISTS "DealAuditLog_actorUserId_idx"
  ON "DealAuditLog" ("actorUserId");
