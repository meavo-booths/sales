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

export async function subsidiaryIds(parentId: string): Promise<string[]> {
  const rows = await prisma.client.findMany({
    where: { parentClientId: parentId },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => row.id);
}

/** Parent id plus all subsidiary ids — for rollup stats on a group head. */
export async function rollupClientIds(parentId: string): Promise<string[]> {
  const ids = await subsidiaryIds(parentId);
  return [parentId, ...ids];
}

export async function rollupRevenueForClientIds(clientIds: string[]): Promise<number> {
  if (clientIds.length === 0) return 0;
  const rows = await prisma.$queryRaw<{ revenue: number }[]>`
    SELECT COALESCE(SUM(li.quantity * COALESCE(li."unitPriceEur", li."unitPrice")), 0)::float AS revenue
    FROM "QuoteLineItem" li
    JOIN "Deal" d ON d.id = li."dealId"
    WHERE d."clientId" = ANY(${clientIds}) AND d.stage = 'WON'
  `;
  return rows[0]?.revenue ?? 0;
}

export async function dealCountsForClientIds(
  clientIds: string[],
): Promise<{ won: number; openQuotes: number }> {
  if (clientIds.length === 0) return { won: 0, openQuotes: 0 };
  const rows = await prisma.deal.groupBy({
    by: ["stage"],
    where: { clientId: { in: clientIds } },
    _count: { _all: true },
  });
  let won = 0;
  let openQuotes = 0;
  for (const row of rows) {
    if (row.stage === "WON") won = row._count._all;
    if (row.stage === "QUOTE") openQuotes = row._count._all;
  }
  return { won, openQuotes };
}

export async function loadClientStats(clientIds: string[]): Promise<{
  revenue: number;
  won: number;
  openQuotes: number;
}> {
  const [revenue, counts] = await Promise.all([
    rollupRevenueForClientIds(clientIds),
    dealCountsForClientIds(clientIds),
  ]);
  return { revenue, ...counts };
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
