import { PrismaClient, Prisma } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
// Relative (not "@/…") so plain tsx scripts that import this client resolve it.
import { getActorUserId } from "./request-context";

/**
 * Fields excluded from the Deal audit diff. These are timestamps and
 * integration bookkeeping written by the Ops File / Xero / Zamp exporters on
 * every sync — logging them would flood the history with machine-driven noise.
 */
const IGNORED_FIELDS = new Set<string>([
  "updatedAt",
  "sheetRows",
  "sheetSyncedAt",
  "sheetSyncError",
  "xeroInvoiceId",
  "xeroInvoiceNumber",
  "xeroSyncedAt",
  "xeroSyncError",
  "xeroFinalInvoiceId",
  "xeroFinalInvoiceNumber",
  "xeroFinalSyncedAt",
  "xeroFinalSyncError",
  "xeroPaymentSyncedAt",
  "zampTransactionId",
  "zampSyncedAt",
  "zampSyncError",
  "usTaxDetail",
]);

type DealRow = Record<string, unknown> & { id: string };
type Change = { field: string; before: unknown; after: unknown };

/** JSON-safe representation of a scalar Deal field (Date/Decimal -> string). */
function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(toJsonValue(a)) === JSON.stringify(toJsonValue(b));
}

function isScalarValue(value: unknown): boolean {
  if (value === null) return true;
  if (value instanceof Date || value instanceof Prisma.Decimal) return true;
  return typeof value !== "object";
}

/**
 * Apply a Prisma `data` payload onto a before-image to derive the after-image.
 * Handles direct scalar assignment and `{ set: value }`; skips relation writes
 * and numeric ops (increment/etc.) and Prisma's "not provided" `undefined`.
 * Deriving the after-image from `data` (rather than re-reading) keeps the diff
 * correct inside interactive transactions, where a separate-connection read
 * would not see the uncommitted row.
 */
function applyUpdateData(before: DealRow, data: Record<string, unknown>): DealRow {
  const after: DealRow = { ...before };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isScalarValue(value)) {
      after[key] = value;
    } else if (value && typeof value === "object" && "set" in (value as Record<string, unknown>)) {
      after[key] = (value as { set: unknown }).set;
    }
    // Relation writes / numeric ops are not audited scalar fields — skip.
  }
  return after;
}

function buildChanges(before: DealRow | null, after: DealRow | null): Change[] {
  const changes: Change[] = [];
  const keys = new Set<string>([
    ...(before ? Object.keys(before) : []),
    ...(after ? Object.keys(after) : []),
  ]);
  for (const field of keys) {
    if (IGNORED_FIELDS.has(field)) continue;
    const b = before ? before[field] : null;
    const a = after ? after[field] : null;
    if (!valuesEqual(b, a)) {
      changes.push({ field, before: toJsonValue(b), after: toJsonValue(a) });
    }
  }
  return changes;
}

async function writeAuditLog(
  base: PrismaClient,
  dealId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  before: DealRow | null,
  after: DealRow | null,
): Promise<void> {
  const changes = buildChanges(before, after);
  // Skip pure sync/timestamp writes that touched no audited field.
  if (action === "UPDATE" && changes.length === 0) return;
  await base.dealAuditLog.create({
    data: {
      dealId,
      actorUserId: getActorUserId(),
      action,
      changes: changes as unknown as Prisma.InputJsonValue,
    },
  });
}

function createPrismaClient() {
  const base = new PrismaClient();

  return base.$extends({
    query: {
      deal: {
        async create({ args, query }) {
          const result = (await query(args)) as DealRow;
          try {
            if (result?.id) await writeAuditLog(base, result.id, "CREATE", null, result);
          } catch (error) {
            console.error("Deal audit log (create) failed:", error);
          }
          return result;
        },

        async update({ args, query }) {
          let before: DealRow | null = null;
          try {
            before = (await base.deal.findUnique({ where: args.where })) as DealRow | null;
          } catch (error) {
            console.error("Deal audit log (update before-image) failed:", error);
          }
          const result = await query(args);
          try {
            if (before) {
              const after = applyUpdateData(before, (args.data ?? {}) as Record<string, unknown>);
              await writeAuditLog(base, before.id, "UPDATE", before, after);
            }
          } catch (error) {
            console.error("Deal audit log (update) failed:", error);
          }
          return result;
        },

        async upsert({ args, query }) {
          let before: DealRow | null = null;
          try {
            before = (await base.deal.findUnique({ where: args.where })) as DealRow | null;
          } catch (error) {
            console.error("Deal audit log (upsert before-image) failed:", error);
          }
          const result = (await query(args)) as DealRow;
          try {
            if (before) {
              const after = applyUpdateData(before, (args.update ?? {}) as Record<string, unknown>);
              await writeAuditLog(base, before.id, "UPDATE", before, after);
            } else if (result?.id) {
              await writeAuditLog(base, result.id, "CREATE", null, result);
            }
          } catch (error) {
            console.error("Deal audit log (upsert) failed:", error);
          }
          return result;
        },

        async updateMany({ args, query }) {
          let befores: DealRow[] = [];
          try {
            befores = (await base.deal.findMany({ where: args.where })) as DealRow[];
          } catch (error) {
            console.error("Deal audit log (updateMany before-image) failed:", error);
          }
          const result = await query(args);
          try {
            for (const before of befores) {
              const after = applyUpdateData(before, (args.data ?? {}) as Record<string, unknown>);
              await writeAuditLog(base, before.id, "UPDATE", before, after);
            }
          } catch (error) {
            console.error("Deal audit log (updateMany) failed:", error);
          }
          return result;
        },

        // Deletes are intentionally not audited: DealAuditLog has an
        // onDelete: Cascade FK to Deal, so a deal's history is removed with the
        // deal and a "DELETE" record could never survive the cascade.
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

/** Interactive transaction client type for the extended Prisma client. */
export type PrismaTransactionClient = Omit<ExtendedPrismaClient, ITXClientDenyList>;

const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
