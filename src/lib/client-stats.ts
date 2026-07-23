import { prisma } from "@/lib/prisma";
import {
  EMPTY_CLIENT_STATS,
  type ClientStats,
} from "@/lib/client-hierarchy";
import type { ClientSort } from "@/lib/client-filters";

/**
 * Per-client stats for any number of clients in two queries total (one
 * revenue aggregate, one deal count groupBy) — never one query per client.
 */
export async function loadClientStatsByClient(
  clientIds: string[],
): Promise<Map<string, ClientStats>> {
  const stats = new Map<string, ClientStats>();
  if (clientIds.length === 0) return stats;
  for (const id of clientIds) stats.set(id, { ...EMPTY_CLIENT_STATS });

  const [revenueRows, countRows] = await Promise.all([
    // Legacy rows without a stored EUR price only count when the deal is in
    // EUR; other currencies would inflate revenue with unconverted amounts
    // (NULL rows are skipped by SUM). Mirrors lineItemUnitPriceEur().
    prisma.$queryRaw<{ clientId: string; revenue: number }[]>`
      SELECT d."clientId" AS "clientId",
             COALESCE(SUM(li.quantity * COALESCE(
               li."unitPriceEur",
               CASE WHEN d.currency = 'EUR' THEN li."unitPrice" END
             )), 0)::float AS revenue
      FROM "QuoteLineItem" li
      JOIN "Deal" d ON d.id = li."dealId"
      WHERE d."clientId" = ANY(${clientIds}) AND d.stage = 'WON'
      GROUP BY d."clientId"
    `,
    prisma.deal.groupBy({
      by: ["clientId", "stage"],
      where: { clientId: { in: clientIds } },
      _count: { _all: true },
    }),
  ]);

  for (const row of revenueRows) {
    const entry = stats.get(row.clientId);
    if (entry) entry.revenue = row.revenue;
  }
  for (const row of countRows) {
    const entry = row.clientId ? stats.get(row.clientId) : undefined;
    if (!entry) continue;
    if (row.stage === "WON") entry.won = row._count._all;
    if (row.stage === "QUOTE") entry.openQuotes = row._count._all;
  }
  return stats;
}

export type ClientSortKey = {
  revenue: number;
  /** Epoch ms of latest won deal; null if none. */
  newestWonAtMs: number | null;
};

/**
 * Revenue + latest wonAt per client (one SQL query). Used for list/CSV sort.
 */
export async function loadClientSortKeys(
  clientIds: string[],
): Promise<Map<string, ClientSortKey>> {
  const keys = new Map<string, ClientSortKey>();
  if (clientIds.length === 0) return keys;
  for (const id of clientIds) {
    keys.set(id, { revenue: 0, newestWonAtMs: null });
  }

  const rows = await prisma.$queryRaw<
    { clientId: string; revenue: number; newestWonAt: Date | null }[]
  >`
    SELECT d."clientId" AS "clientId",
           COALESCE(SUM(li.quantity * COALESCE(
             li."unitPriceEur",
             CASE WHEN d.currency = 'EUR' THEN li."unitPrice" END
           )), 0)::float AS revenue,
           MAX(d."wonAt") AS "newestWonAt"
    FROM "Deal" d
    LEFT JOIN "QuoteLineItem" li ON li."dealId" = d.id
    WHERE d."clientId" = ANY(${clientIds}) AND d.stage = 'WON'
    GROUP BY d."clientId"
  `;

  for (const row of rows) {
    keys.set(row.clientId, {
      revenue: row.revenue,
      newestWonAtMs: row.newestWonAt ? row.newestWonAt.getTime() : null,
    });
  }
  return keys;
}

type SortableClient = {
  id: string;
  name: string;
  isVip: boolean;
  /** Subsidiary client ids (empty for non-parents). */
  subsidiaryIds: string[];
};

function rolledSortKey(
  client: SortableClient,
  keysById: Map<string, ClientSortKey>,
): ClientSortKey {
  const ids = [client.id, ...client.subsidiaryIds];
  let revenue = 0;
  let newestWonAtMs: number | null = null;
  for (const id of ids) {
    const key = keysById.get(id);
    if (!key) continue;
    revenue += key.revenue;
    if (key.newestWonAtMs != null) {
      newestWonAtMs =
        newestWonAtMs == null
          ? key.newestWonAtMs
          : Math.max(newestWonAtMs, key.newestWonAtMs);
    }
  }
  return { revenue, newestWonAtMs };
}

/**
 * Sort clients for list/CSV. Parents use rolled-up revenue / newest wonAt
 * (parent + subsidiaries) so order matches card stats.
 */
export function sortClientsForList<T extends SortableClient>(
  clients: T[],
  sort: ClientSort,
  keysById: Map<string, ClientSortKey>,
): T[] {
  const decorated = clients.map((client) => ({
    client,
    key: rolledSortKey(client, keysById),
  }));

  decorated.sort((a, b) => {
    if (sort === "revenue") {
      const diff = b.key.revenue - a.key.revenue;
      if (diff !== 0) return diff;
    } else if (sort === "newest") {
      const aMs = a.key.newestWonAtMs ?? -1;
      const bMs = b.key.newestWonAtMs ?? -1;
      if (bMs !== aMs) return bMs - aMs;
    } else {
      // Alphabetically: VIP first, then name (matches prior Prisma orderBy).
      if (a.client.isVip !== b.client.isVip) {
        return a.client.isVip ? -1 : 1;
      }
    }
    return a.client.name.localeCompare(b.client.name, undefined, {
      sensitivity: "base",
    });
  });

  return decorated.map((d) => d.client);
}
