import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { CLIENT_TYPE_LABELS, formatMoney } from "@/lib/deal-values";
import {
  appendFilterParams,
  parseClientFilterValues,
  parseClientTypeFilters,
} from "@/lib/client-filters";
import { AddClientButton } from "@/components/add-client-button";
import { ClientListFilters } from "@/components/client-list-filters";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; type?: string | string[]; country?: string | string[] }>;
}) {
  await requireSalesAccess();

  const { q, page: pageParam, type, country } = await searchParams;
  const search = (q ?? "").trim();
  const selectedTypes = parseClientTypeFilters(type);
  const selectedCountries = parseClientFilterValues(country);

  const and: Prisma.ClientWhereInput[] = [];
  if (search) and.push({ name: { contains: search, mode: "insensitive" } });
  if (selectedTypes.length > 0) and.push({ clientType: { in: selectedTypes } });
  if (selectedCountries.length > 0) and.push({ market: { in: selectedCountries } });
  const where: Prisma.ClientWhereInput = and.length > 0 ? { AND: and } : {};

  const [totalClients, countryRows] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where: { market: { not: "" } },
      distinct: ["market"],
      select: { market: true },
      orderBy: { market: "asc" },
    }),
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
  });

  const clientIds = clients.map((client) => client.id);

  const [revenueRows, dealCounts] = clientIds.length
    ? await Promise.all([
        prisma.$queryRaw<{ clientId: string; revenue: number }[]>`
          SELECT d."clientId" AS "clientId",
                 COALESCE(SUM(li.quantity * li."unitPrice"), 0)::float AS revenue
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
      ])
    : [[], []];

  const revenueByClient = new Map(revenueRows.map((row) => [row.clientId, row.revenue]));
  const wonByClient = new Map<string, number>();
  const openByClient = new Map<string, number>();
  for (const row of dealCounts) {
    if (!row.clientId) continue;
    if (row.stage === "WON") wonByClient.set(row.clientId, row._count._all);
    if (row.stage === "QUOTE") openByClient.set(row.clientId, row._count._all);
  }

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    appendFilterParams(query, "type", selectedTypes);
    appendFilterParams(query, "country", selectedCountries);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/clients?${qs}` : "/clients";
  };

  return (
    <>
      <PageHeader title="Clients" description="Client directory with deal history and stats.">
        <AddClientButton />
      </PageHeader>

      <div className="space-y-4">
        <ClientListFilters
          search={search}
          selectedTypes={selectedTypes}
          selectedCountries={selectedCountries}
          countries={countries}
        />

        {clients.length === 0 ? (
          <EmptyState>
            {search || selectedTypes.length > 0 || selectedCountries.length > 0
              ? "No clients match these filters."
              : "No clients yet. Add your first client."}
          </EmptyState>
        ) : (
          clients.map((client) => {
            const wonCount = wonByClient.get(client.id) ?? 0;
            const openQuotes = openByClient.get(client.id) ?? 0;
            const revenue = revenueByClient.get(client.id) ?? 0;
            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="block">
                <Card className="transition hover:border-brand-500/40 hover:shadow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{client.name}</span>
                        {client.isVip && <VipBadge />}
                        <Badge tone="slate">{CLIENT_TYPE_LABELS[client.clientType]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {[client.market, client.website].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatMoney(revenue)}</p>
                      <p className="text-sm text-slate-500">
                        {wonCount} deal{wonCount === 1 ? "" : "s"} · {openQuotes} open quote
                        {openQuotes === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
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
