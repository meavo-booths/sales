import { prisma } from "@/lib/prisma";
import {
  EMPTY_CLIENT_STATS,
  type ClientStats,
} from "@/lib/client-hierarchy";

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
