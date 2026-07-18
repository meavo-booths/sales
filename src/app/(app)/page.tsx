import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dealTotalEur } from "@/lib/line-item-eur";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  CLIENT_TYPE_LABELS,
  DEAL_STAGE_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import {
  buildDealListHref,
  buildDealListWhere,
  countDealSidebarFilters,
  hasDealListFilters,
  mergeSocketTypeOptions,
  parseClientTypeFilters,
  parseDealSort,
  parseMarketFilters,
  parsePaymentStatusFilters,
  parseSalesRepFilters,
  parseSocketTypeFilters,
  type DealListUrlState,
} from "@/lib/deal-list-filters";
import { DealListFiltersSidebar } from "@/components/deal-list-filters-sidebar";
import { DealListShell } from "@/components/deal-list-shell";
import { DealListToolbar } from "@/components/deal-list-toolbar";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";
import { ListPagination } from "@/components/list-pagination";
import { LIST_PAGE_SIZE, parseListPage } from "@/lib/list-pagination";

export const dynamic = "force-dynamic";

const STAGE_TONES = { QUOTE: "blue", WON: "green", LOST: "red" } as const;

const FILTERS = [
  { key: "open", label: "Open quotes" },
  { key: "all", label: "All" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

const SCOPES = [
  { key: "mine", label: "My quotes" },
  { key: "all", label: "See all" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type ScopeKey = (typeof SCOPES)[number]["key"];

function stageWhere(filter: FilterKey): Prisma.DealWhereInput {
  if (filter === "open") return { stage: "QUOTE" };
  if (filter === "won") return { stage: "WON" };
  if (filter === "lost") return { stage: "LOST" };
  return {};
}

function urlState(
  filter: FilterKey,
  scope: ScopeKey,
  listFilters: Omit<DealListUrlState, "scope" | "quotesFilter" | "dealsPaymentPill" | "page">,
  page?: number,
): DealListUrlState {
  return {
    ...listFilters,
    scope,
    quotesFilter: filter,
    page,
  };
}

function listHref(
  filter: FilterKey,
  scope: ScopeKey,
  listFilters: Omit<DealListUrlState, "scope" | "quotesFilter" | "dealsPaymentPill" | "page">,
): string {
  return buildDealListHref("/", urlState(filter, scope, listFilters), "quotes");
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    scope?: string;
    page?: string;
    q?: string;
    sort?: string;
    type?: string | string[];
    market?: string | string[];
    salesRep?: string | string[];
    payment?: string | string[];
    socket?: string | string[];
  }>;
}) {
  const session = await requireSalesAccess();

  const params = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as FilterKey)
    : "open";
  const scope: ScopeKey = params.scope === "all" ? "all" : "mine";

  const listFilters = {
    search: (params.q ?? "").trim(),
    sort: parseDealSort(params.sort),
    clientTypes: parseClientTypeFilters(params.type),
    markets: parseMarketFilters(params.market),
    salesReps: parseSalesRepFilters(params.salesRep),
    paymentStatuses: parsePaymentStatusFilters(params.payment),
    socketTypes: parseSocketTypeFilters(params.socket),
  };

  const baseWhere: Prisma.DealWhereInput = {
    ...stageWhere(filter),
    ...(scope === "mine" ? { createdByUserId: session.user.id } : {}),
  };
  const where = buildDealListWhere(baseWhere, listFilters);
  const sortDirection = listFilters.sort === "date_asc" ? "asc" : "desc";

  const [totalQuotes, salesRepRows, socketRows] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where: { salesRep: { not: "" } },
      distinct: ["salesRep"],
      select: { salesRep: true },
      orderBy: { salesRep: "asc" },
    }),
    prisma.deal.findMany({
      where: { socketType: { not: "" } },
      distinct: ["socketType"],
      select: { socketType: true },
      orderBy: { socketType: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalQuotes / LIST_PAGE_SIZE));
  const page = parseListPage(params.page, totalPages);

  const quotes = await prisma.deal.findMany({
    where,
    orderBy: { dealDate: sortDirection },
    skip: (page - 1) * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE,
    include: {
      lineItems: { include: { product: { select: { kind: true } } } },
      client: { select: { isVip: true } },
    },
  });

  const pageHref = (target: number) =>
    buildDealListHref("/", urlState(filter, scope, listFilters, target), "quotes");

  const filtersActive = hasDealListFilters(listFilters);
  const emptyMessage = filtersActive
    ? "No quotes match these filters."
    : filter === "open"
      ? scope === "mine"
        ? "You have no open quotes."
        : "No open quotes."
      : "No quotes here yet. Create your first quote.";

  return (
    <>
      <PageHeader title="Quotes" description="Generate quotes and convert them into won deals.">
        <Link
          href="/quotes/new"
          className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          New quote
        </Link>
      </PageHeader>

      <DealListShell
        activeFilterCount={countDealSidebarFilters({
          variant: "quotes",
          scope,
          quotesFilter: filter,
          clientTypes: listFilters.clientTypes,
          markets: listFilters.markets,
          salesReps: listFilters.salesReps,
          paymentStatuses: listFilters.paymentStatuses,
          socketTypes: listFilters.socketTypes,
        })}
        sidebar={
          <DealListFiltersSidebar
            basePath="/"
            variant="quotes"
            search={listFilters.search}
            sort={listFilters.sort}
            selectedTypes={listFilters.clientTypes}
            selectedMarkets={listFilters.markets}
            selectedSalesReps={listFilters.salesReps}
            selectedPaymentStatuses={listFilters.paymentStatuses}
            selectedSocketTypes={listFilters.socketTypes}
            salesRepOptions={salesRepRows.map((row) => row.salesRep)}
            socketTypeOptions={mergeSocketTypeOptions(socketRows.map((row) => row.socketType))}
            scope={scope}
            quotesFilter={filter}
            ownershipPills={SCOPES.map((s) => ({
              key: s.key,
              label: s.label,
              href: listHref(filter, s.key, listFilters),
              active: scope === s.key,
            }))}
            statusPills={FILTERS.map((f) => ({
              key: f.key,
              label: f.label,
              href: listHref(f.key, scope, listFilters),
              active: filter === f.key,
            }))}
          />
        }
        toolbar={
          <DealListToolbar
            basePath="/"
            variant="quotes"
            search={listFilters.search}
            sort={listFilters.sort}
            scope={scope}
            quotesFilter={filter}
            clientTypes={listFilters.clientTypes}
            markets={listFilters.markets}
            salesReps={listFilters.salesReps}
            paymentStatuses={listFilters.paymentStatuses}
            socketTypes={listFilters.socketTypes}
          />
        }
      >
        {quotes.length === 0 ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          <div className="space-y-3">
            {quotes.map((quote) => {
              const total = dealTotalEur(quote);
              const booths = quote.lineItems
                .filter((li) => li.product?.kind === "BOOTH")
                .reduce((sum, li) => sum + li.quantity, 0);
              const href = quote.stage === "WON" ? `/deals/${quote.id}` : `/quotes/${quote.id}`;
              return (
                <Link key={quote.id} href={href} className="block">
                  <Card className="transition hover:border-brand-500/40 hover:shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{quote.quoteNumber}</span>
                          {quote.dealId && (
                            <span className="text-sm text-slate-500">Deal {quote.dealId}</span>
                          )}
                          <Badge tone={STAGE_TONES[quote.stage]}>
                            {DEAL_STAGE_LABELS[quote.stage]}
                          </Badge>
                          {quote.client?.isVip && <VipBadge />}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {quote.clientName}
                          {quote.market && ` · ${quote.market}`}
                          {` · ${CLIENT_TYPE_LABELS[quote.clientType]}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">
                          {total == null ? "—" : formatMoney(total)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {booths} booth{booths === 1 ? "" : "s"} · {formatDate(quote.dealDate)}
                          {quote.salesRep && ` · ${quote.salesRep}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}

            <ListPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalQuotes}
              pageHref={pageHref}
              countLabel="quote"
            />
          </div>
        )}
      </DealListShell>
    </>
  );
}
