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
  parseClientTypeFilters,
} from "@/lib/client-filters";
import {
  clientHierarchyRole,
  hierarchyWhere,
  isClientVip,
  loadClientStats,
  rollupClientIds,
} from "@/lib/client-hierarchy";
import { AddClientButton } from "@/components/add-client-button";
import { ClientListFilters } from "@/components/client-list-filters";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type ClientRow = {
  id: string;
  name: string;
  market: string;
  website: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  isVip: boolean;
  parentClientId: string | null;
  parent?: { isVip: boolean } | null;
  _count: { subsidiaries: number };
};

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
  }>;
}) {
  await requireSalesAccess();

  const { q, page: pageParam, type, country, view } = await searchParams;
  const search = (q ?? "").trim();
  const selectedTypes = parseClientTypeFilters(type);
  const selectedCountries = parseClientFilterValues(country);
  const hierarchyView = parseClientHierarchyView(view);

  const and: Prisma.ClientWhereInput[] = [hierarchyWhere(hierarchyView)];
  if (search) and.push({ name: { contains: search, mode: "insensitive" } });
  if (selectedTypes.length > 0) and.push({ clientType: { in: selectedTypes } });
  if (selectedCountries.length > 0) and.push({ market: { in: selectedCountries } });
  const where: Prisma.ClientWhereInput = { AND: and };

  const [totalClients, countryRows, parentOptions] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where: { market: { not: "" } },
      distinct: ["market"],
      select: { market: true },
      orderBy: { market: "asc" },
    }),
    listParentCompanyOptions(),
  ]);
  const countries = countryRows.map((row) => row.market);

  const totalPages = Math.max(1, Math.ceil(totalClients / PAGE_SIZE));
  const requestedPage = Number(pageParam);
  const page = Math.min(
    totalPages,
    Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1,
  );

  const clients = await prisma.client.findMany({
    where,
    orderBy: [{ isVip: "desc" }, { name: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      parent: { select: { isVip: true, name: true } },
      _count: { select: { subsidiaries: true } },
    },
  });

  const parentIdsOnPage = clients
    .filter((client) => client._count.subsidiaries > 0)
    .map((client) => client.id);

  const nestedSubsidiaries =
    hierarchyView === "top" && parentIdsOnPage.length > 0
      ? await prisma.client.findMany({
          where: { parentClientId: { in: parentIdsOnPage } },
          orderBy: { name: "asc" },
          include: {
            parent: { select: { isVip: true, name: true } },
            _count: { select: { subsidiaries: true } },
          },
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

  const statsByClient = new Map<string, { revenue: number; won: number; openQuotes: number }>();

  await Promise.all(
    clients.map(async (client) => {
      const isParent = client._count.subsidiaries > 0;
      const ids = isParent ? await rollupClientIds(client.id) : [client.id];
      statsByClient.set(client.id, await loadClientStats(ids));
    }),
  );

  await Promise.all(
    nestedSubsidiaries.map(async (client) => {
      statsByClient.set(client.id, await loadClientStats([client.id]));
    }),
  );

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    appendFilterParams(query, "type", selectedTypes);
    appendFilterParams(query, "country", selectedCountries);
    if (hierarchyView !== "top") query.set("view", hierarchyView);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  return (
    <>
      <PageHeader title="Clients" description="Client directory with deal history and stats.">
        <AddClientButton parentOptions={parentOptions} />
      </PageHeader>

      <div className="space-y-4">
        <ClientListFilters
          search={search}
          selectedTypes={selectedTypes}
          selectedCountries={selectedCountries}
          countries={countries}
          hierarchyView={hierarchyView}
        />

        {clients.length === 0 ? (
          <EmptyState>
            {search || selectedTypes.length > 0 || selectedCountries.length > 0
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="font-medium text-brand-700 hover:underline"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {totalPages} · {totalClients} client
              {totalClients !== 1 ? "s" : ""}
              {allVisibleIds.length > clients.length
                ? ` (${allVisibleIds.length} shown with subsidiaries)`
                : ""}
            </span>
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="font-medium text-brand-700 hover:underline"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </>
  );
}
