import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { listParentCompanyOptions } from "@/app/actions/clients";
import { CLIENT_TYPE_LABELS, formatMoney } from "@/lib/deal-values";
import {
  appendFilterParams,
  parseClientFilterValues,
  parseClientHierarchyView,
  parseClientSort,
  parseClientTypeFilters,
} from "@/lib/client-filters";
import {
  clientHierarchyRole,
  hierarchyWhere,
  isClientVip,
  sumClientStats,
  type ClientStats,
} from "@/lib/client-hierarchy";
import {
  loadClientSortKeys,
  loadClientStatsByClient,
  sortClientsForList,
} from "@/lib/client-stats";
import { AddClientButton } from "@/components/add-client-button";
import { ClientCsvExportButton } from "@/components/client-csv-export";
import { ClientCsvImportButton } from "@/components/client-csv-import";
import { ClientListFilters } from "@/components/client-list-filters";
import { ListPagination } from "@/components/list-pagination";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";
import { LIST_PAGE_SIZE, parseListPage } from "@/lib/list-pagination";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  name: string;
  market: string;
  website: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING" | "SHOWROOM" | "INTERNAL_EVENTS";
  isVip: boolean;
  parentClientId: string | null;
  parent?: { isVip: boolean } | null;
  _count: { subsidiaries: number };
};

const clientListInclude = {
  parent: { select: { isVip: true, name: true } },
  _count: { select: { subsidiaries: true } },
} as const;

function ClientListCard({
  client,
  revenue,
  wonCount,
  openQuotes,
  indent = false,
  groupLabel,
}: {
  client: ClientRow;
  revenue: number;
  wonCount: number;
  openQuotes: number;
  indent?: boolean;
  groupLabel?: string;
}) {
  const role = clientHierarchyRole(client, client._count.subsidiaries);
  const showVip = isClientVip(client, client.parent);

  return (
    <Link href={`/clients/${client.id}`} className="block">
      <Card
        className={`transition hover:border-brand-500/40 hover:shadow ${
          indent ? "ml-6 border-l-4 border-l-brand-200" : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`font-semibold text-slate-900 ${indent ? "text-sm" : ""}`}
              >
                {client.name}
              </span>
              {showVip && <VipBadge />}
              {role === "parent" && <Badge tone="blue">Group</Badge>}
              {role === "subsidiary" && groupLabel && (
                <Badge tone="slate">{groupLabel}</Badge>
              )}
              <Badge tone="slate">{CLIENT_TYPE_LABELS[client.clientType]}</Badge>
            </div>
            <p className={`mt-1 text-slate-600 ${indent ? "text-xs" : "text-sm"}`}>
              {[client.market, client.website].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className={`font-semibold text-slate-900 ${indent ? "text-sm" : ""}`}>
              {formatMoney(revenue)}
            </p>
            <p className={`text-slate-500 ${indent ? "text-xs" : "text-sm"}`}>
              {wonCount} deal{wonCount === 1 ? "" : "s"} · {openQuotes} open quote
              {openQuotes === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    type?: string | string[];
    country?: string | string[];
    view?: string;
    sort?: string;
  }>;
}) {
  const session = await requireSalesAccess();

  const { q, page: pageParam, type, country, view, sort: sortParam } = await searchParams;
  const search = (q ?? "").trim();
  const selectedTypes = parseClientTypeFilters(type);
  const selectedCountries = parseClientFilterValues(country);
  const hierarchyView = parseClientHierarchyView(view);
  const sort = parseClientSort(sortParam);

  const and: Prisma.ClientWhereInput[] = [hierarchyWhere(hierarchyView)];
  if (search) and.push({ name: { contains: search, mode: "insensitive" } });
  if (selectedTypes.length > 0) and.push({ clientType: { in: selectedTypes } });
  if (selectedCountries.length > 0) and.push({ market: { in: selectedCountries } });
  const where: Prisma.ClientWhereInput = { AND: and };

  const [totalClients, countryRows, parentOptions, user] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where: { market: { not: "" } },
      distinct: ["market"],
      select: { market: true },
      orderBy: { market: "asc" },
    }),
    listParentCompanyOptions(),
    prisma.user.findUnique({
      where: { id: session.user!.id },
      select: { systemRole: true },
    }),
  ]);
  const countries = countryRows.map((row) => row.market);
  const isAdmin = user?.systemRole === "ADMIN";

  const totalPages = Math.max(1, Math.ceil(totalClients / LIST_PAGE_SIZE));
  const page = parseListPage(pageParam, totalPages);

  let clients: ClientRow[];

  if (sort === "name") {
    clients = await prisma.client.findMany({
      where,
      orderBy: [{ isVip: "desc" }, { name: "asc" }],
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
      include: clientListInclude,
    });
  } else {
    // Revenue / newest: sort all matching IDs (with parent rollups), then page.
    const sortRows = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        isVip: true,
        subsidiaries: { select: { id: true } },
      },
    });
    const sortKeyIds = [
      ...new Set([
        ...sortRows.map((r) => r.id),
        ...sortRows.flatMap((r) => r.subsidiaries.map((s) => s.id)),
      ]),
    ];
    const keysById = await loadClientSortKeys(sortKeyIds);
    const ordered = sortClientsForList(
      sortRows.map((r) => ({
        id: r.id,
        name: r.name,
        isVip: r.isVip,
        subsidiaryIds: r.subsidiaries.map((s) => s.id),
      })),
      sort,
      keysById,
    );
    const pageIds = ordered
      .slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE)
      .map((r) => r.id);

    if (pageIds.length === 0) {
      clients = [];
    } else {
      const pageRows = await prisma.client.findMany({
        where: { id: { in: pageIds } },
        include: clientListInclude,
      });
      const byId = new Map(pageRows.map((row) => [row.id, row]));
      clients = pageIds
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
    }
  }

  const parentIdsOnPage = clients
    .filter((client) => client._count.subsidiaries > 0)
    .map((client) => client.id);

  const nestedSubsidiaries =
    hierarchyView === "top" && parentIdsOnPage.length > 0
      ? await prisma.client.findMany({
          where: { parentClientId: { in: parentIdsOnPage } },
          orderBy: { name: "asc" },
          include: clientListInclude,
        })
      : [];

  const subsidiariesByParent = new Map<string, ClientRow[]>();
  for (const sub of nestedSubsidiaries) {
    if (!sub.parentClientId) continue;
    const list = subsidiariesByParent.get(sub.parentClientId) ?? [];
    list.push(sub);
    subsidiariesByParent.set(sub.parentClientId, list);
  }

  const allVisibleIds = [
    ...clients.map((c) => c.id),
    ...nestedSubsidiaries.map((c) => c.id),
  ];

  // Parent rollups need every subsidiary id in any view; the "top" view
  // already loaded them all, other views only need the id links.
  const subsidiaryLinks: { id: string; parentClientId: string | null }[] =
    hierarchyView === "top"
      ? nestedSubsidiaries.map((sub) => ({ id: sub.id, parentClientId: sub.parentClientId }))
      : parentIdsOnPage.length > 0
        ? await prisma.client.findMany({
            where: { parentClientId: { in: parentIdsOnPage } },
            select: { id: true, parentClientId: true },
          })
        : [];

  const subsidiaryIdsByParent = new Map<string, string[]>();
  for (const link of subsidiaryLinks) {
    if (!link.parentClientId) continue;
    const list = subsidiaryIdsByParent.get(link.parentClientId) ?? [];
    list.push(link.id);
    subsidiaryIdsByParent.set(link.parentClientId, list);
  }

  // Two aggregate queries for the whole page instead of several per client.
  const statsById = await loadClientStatsByClient([
    ...new Set([...clients.map((c) => c.id), ...subsidiaryLinks.map((l) => l.id)]),
  ]);

  const statsByClient = new Map<string, ClientStats>();
  for (const client of clients) {
    const isParent = client._count.subsidiaries > 0;
    statsByClient.set(
      client.id,
      isParent
        ? sumClientStats(statsById, [
            client.id,
            ...(subsidiaryIdsByParent.get(client.id) ?? []),
          ])
        : (statsById.get(client.id) ?? { revenue: 0, won: 0, openQuotes: 0 }),
    );
  }
  for (const sub of nestedSubsidiaries) {
    statsByClient.set(sub.id, statsById.get(sub.id) ?? { revenue: 0, won: 0, openQuotes: 0 });
  }

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    appendFilterParams(query, "type", selectedTypes);
    appendFilterParams(query, "country", selectedCountries);
    if (hierarchyView !== "top") query.set("view", hierarchyView);
    if (sort !== "name") query.set("sort", sort);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  return (
    <>
      <PageHeader title="Clients" description="Client directory with deal history and stats.">
        <div className="flex flex-wrap items-center gap-2">
          <AddClientButton parentOptions={parentOptions} />
          <ClientCsvExportButton
            search={search}
            selectedTypes={selectedTypes}
            selectedCountries={selectedCountries}
            hierarchyView={hierarchyView}
            sort={sort}
          />
          {isAdmin && <ClientCsvImportButton />}
        </div>
      </PageHeader>

      <div className="mb-6">
        <ClientListFilters
          search={search}
          selectedTypes={selectedTypes}
          selectedCountries={selectedCountries}
          countries={countries}
          hierarchyView={hierarchyView}
          sort={sort}
        />
      </div>

      <div className="space-y-4">
        {clients.length === 0 ? (
          <EmptyState>
            {search ||
            selectedTypes.length > 0 ||
            selectedCountries.length > 0 ||
            hierarchyView !== "top" ||
            sort !== "name"
              ? "No clients match these filters."
              : "No clients yet. Add your first client."}
          </EmptyState>
        ) : (
          clients.map((client) => {
            const stats = statsByClient.get(client.id) ?? { revenue: 0, won: 0, openQuotes: 0 };
            const subs = subsidiariesByParent.get(client.id) ?? [];
            return (
              <div key={client.id} className="space-y-2">
                <ClientListCard
                  client={client}
                  revenue={stats.revenue}
                  wonCount={stats.won}
                  openQuotes={stats.openQuotes}
                />
                {subs.map((sub) => {
                  const subStats = statsByClient.get(sub.id) ?? {
                    revenue: 0,
                    won: 0,
                    openQuotes: 0,
                  };
                  return (
                    <ClientListCard
                      key={sub.id}
                      client={sub}
                      revenue={subStats.revenue}
                      wonCount={subStats.won}
                      openQuotes={subStats.openQuotes}
                      indent
                      groupLabel={client.name}
                    />
                  );
                })}
              </div>
            );
          })
        )}

        <ListPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalClients}
          pageHref={pageHref}
          countLabel="client"
          summarySuffix={
            allVisibleIds.length > clients.length
              ? ` (${allVisibleIds.length} shown with subsidiaries)`
              : undefined
          }
        />
      </div>
    </>
  );
}
