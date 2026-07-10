import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ClientHierarchyView = "top" | "groups" | "subsidiaries" | "all";

export type ClientHierarchyRole = "standalone" | "parent" | "subsidiary";

const HIERARCHY_VIEWS: ClientHierarchyView[] = ["top", "groups", "subsidiaries", "all"];

export function parseClientHierarchyView(
  raw: string | undefined,
): ClientHierarchyView {
  if (raw && HIERARCHY_VIEWS.includes(raw as ClientHierarchyView)) {
    return raw as ClientHierarchyView;
  }
  return "top";
}

export function clientHierarchyRole(
  client: { parentClientId: string | null },
  subsidiaryCount: number,
): ClientHierarchyRole {
  if (client.parentClientId) return "subsidiary";
  if (subsidiaryCount > 0) return "parent";
  return "standalone";
}

/** Quotes and deals attach to subsidiaries and standalone clients only. */
export function isQuoteSelectableClient(subsidiaryCount: number): boolean {
  return subsidiaryCount === 0;
}

export function isClientVip(
  client: { isVip: boolean },
  parent?: { isVip: boolean } | null,
): boolean {
  return client.isVip || (parent?.isVip ?? false);
}

export function hierarchyWhere(view: ClientHierarchyView): Prisma.ClientWhereInput {
  switch (view) {
    case "top":
      return { parentClientId: null };
    case "groups":
      return { parentClientId: null, subsidiaries: { some: {} } };
    case "subsidiaries":
      return { parentClientId: { not: null } };
    case "all":
    default:
      return {};
  }
}

export type ClientStats = {
  revenue: number;
  won: number;
  openQuotes: number;
};

const EMPTY_STATS: ClientStats = { revenue: 0, won: 0, openQuotes: 0 };

/**
 * Per-client stats for any number of clients in two queries total (one
 * revenue aggregate, one deal count groupBy) — never one query per client.
 */
export async function loadClientStatsByClient(
  clientIds: string[],
): Promise<Map<string, ClientStats>> {
  const stats = new Map<string, ClientStats>();
  if (clientIds.length === 0) return stats;
  for (const id of clientIds) stats.set(id, { ...EMPTY_STATS });

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

/** Combined stats for a group head: its own record plus all subsidiaries. */
export function sumClientStats(
  statsByClient: Map<string, ClientStats>,
  clientIds: string[],
): ClientStats {
  const total: ClientStats = { ...EMPTY_STATS };
  for (const id of clientIds) {
    const entry = statsByClient.get(id);
    if (!entry) continue;
    total.revenue += entry.revenue;
    total.won += entry.won;
    total.openQuotes += entry.openQuotes;
  }
  return total;
}

type QuotePickerClientRow = {
  id: string;
  name: string;
  registeredAddress: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  market: string;
  website: string;
  isVip: boolean;
  parentClientId: string | null;
  parent: { name: string; isVip: boolean } | null;
  _count: { subsidiaries: number };
  contacts: {
    kind: "MAIN" | "FINANCE" | "ASSEMBLY";
    name: string;
    email: string;
    phone: string;
    role: string;
  }[];
};

export function mapClientsForQuotePicker(clients: QuotePickerClientRow[]) {
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    registeredAddress: c.registeredAddress,
    vatNumber: c.vatNumber,
    clientType: c.clientType,
    market: c.market,
    website: c.website,
    isVip: c.isVip,
    parentClientId: c.parentClientId,
    parentName: c.parent?.name ?? null,
    parentIsVip: c.parent?.isVip ?? false,
    subsidiaryCount: c._count.subsidiaries,
    contacts: c.contacts.map((contact) => ({
      kind: contact.kind,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: contact.role,
    })),
  }));
}
