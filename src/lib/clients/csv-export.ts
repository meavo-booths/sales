import type { DealClientType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clientHierarchyRole,
  hierarchyWhere,
  isClientVip,
  sumClientStats,
  type ClientHierarchyView,
} from "@/lib/client-hierarchy";
import type { ClientSort } from "@/lib/client-filters";
import {
  loadClientSortKeys,
  loadClientStatsByClient,
  sortClientsForList,
} from "@/lib/client-stats";
import { CLIENT_TYPE_LABELS } from "@/lib/deal-values";

export type ClientCsvExportFilters = {
  search: string;
  clientTypes: DealClientType[];
  countries: string[];
  hierarchyView: ClientHierarchyView;
  sort: ClientSort;
};

const CSV_HEADERS = [
  "Company Name",
  "Market",
  "Client Type",
  "Website",
  "Parent Company",
  "Hierarchy",
  "VIP",
  "Revenue (EUR)",
  "Won deals",
  "Open quotes",
] as const;

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildWhere(filters: ClientCsvExportFilters): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [hierarchyWhere(filters.hierarchyView)];
  const search = filters.search.trim();
  if (search) and.push({ name: { contains: search, mode: "insensitive" } });
  if (filters.clientTypes.length > 0) {
    and.push({ clientType: { in: filters.clientTypes } });
  }
  if (filters.countries.length > 0) {
    and.push({ market: { in: filters.countries } });
  }
  return { AND: and };
}

function formatDateStamp(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a CSV of every client matching the current list filters (all pages).
 * Parent rows use rolled-up revenue / won / open-quote stats (parent + subsidiaries).
 * Row order follows the list Sort control.
 */
export async function buildClientsCsvExport(
  filters: ClientCsvExportFilters,
): Promise<{ filename: string; csvText: string }> {
  const where = buildWhere(filters);

  const clients = await prisma.client.findMany({
    where,
    include: {
      parent: { select: { name: true, isVip: true } },
      subsidiaries: { select: { id: true } },
      _count: { select: { subsidiaries: true } },
    },
  });

  const allIds = new Set<string>();
  for (const client of clients) {
    allIds.add(client.id);
    for (const sub of client.subsidiaries) allIds.add(sub.id);
  }
  const idList = [...allIds];
  const [statsById, keysById] = await Promise.all([
    loadClientStatsByClient(idList),
    loadClientSortKeys(idList),
  ]);

  const ordered = sortClientsForList(
    clients.map((client) => ({
      ...client,
      subsidiaryIds: client.subsidiaries.map((s) => s.id),
    })),
    filters.sort,
    keysById,
  );

  const lines: string[] = [CSV_HEADERS.map(escapeCsvCell).join(",")];

  for (const client of ordered) {
    const role = clientHierarchyRole(client, client._count.subsidiaries);
    const stats =
      role === "parent"
        ? sumClientStats(statsById, [client.id, ...client.subsidiaryIds])
        : (statsById.get(client.id) ?? { revenue: 0, won: 0, openQuotes: 0 });

    const row = [
      client.name,
      client.market,
      CLIENT_TYPE_LABELS[client.clientType],
      client.website,
      client.parent?.name ?? "",
      role,
      isClientVip(client, client.parent) ? "Yes" : "No",
      stats.revenue.toFixed(2),
      stats.won,
      stats.openQuotes,
    ];
    lines.push(row.map(escapeCsvCell).join(","));
  }

  // UTF-8 BOM helps Excel open the file with correct encoding.
  const csvText = `\uFEFF${lines.join("\n")}\n`;
  return {
    filename: `clients-${formatDateStamp()}.csv`,
    csvText,
  };
}
