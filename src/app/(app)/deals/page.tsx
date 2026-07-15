import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { dealTotalEur } from "@/lib/line-item-eur";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  BOOTH_UNIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import {
  buildDealListHref,
  buildDealListWhere,
  hasDealListFilters,
  mergeSocketTypeOptions,
  parseClientTypeFilters,
  parseDealSort,
  parseMarketFilters,
  parseSalesRepFilters,
  parseSocketTypeFilters,
  type DealListUrlState,
} from "@/lib/deal-list-filters";
import { DealListToolbar } from "@/components/deal-list-toolbar";
import { LIST_PAGE_SIZE, parseListPage } from "@/lib/list-pagination";
import { ListPagination } from "@/components/list-pagination";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAYMENT_TONES: Record<PaymentStatus, "red" | "amber" | "green"> = {
  UNPAID: "red",
  PARTIALLY_PAID: "amber",
  PAID: "green",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "UNPAID", label: "Unpaid" },
  { key: "PARTIALLY_PAID", label: "Partially paid" },
  { key: "PAID", label: "Paid" },
] as const;

const SCOPES = [
  { key: "mine", label: "My deals" },
  { key: "all", label: "See all" },
] as const;

type ScopeKey = (typeof SCOPES)[number]["key"];

function urlState(
  payment: string,
  scope: ScopeKey,
  listFilters: Omit<DealListUrlState, "scope" | "quotesFilter" | "dealsPaymentPill" | "page">,
  page?: number,
): DealListUrlState {
  return {
    ...listFilters,
    scope,
    dealsPaymentPill: payment,
    page,
  };
}

function listHref(
  payment: string,
  scope: ScopeKey,
  listFilters: Omit<DealListUrlState, "scope" | "quotesFilter" | "dealsPaymentPill" | "page">,
): string {
  return buildDealListHref("/deals", urlState(payment, scope, listFilters), "deals");
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment?: string;
    scope?: string;
    page?: string;
    q?: string;
    sort?: string;
    type?: string | string[];
    market?: string | string[];
    salesRep?: string | string[];
    socket?: string | string[];
  }>;
}) {
  const session = await requireSalesAccess();

  const params = await searchParams;
  const paymentParam = params.payment ?? "all";
  const payment = FILTERS.some((f) => f.key === paymentParam) ? paymentParam : "all";
  const scope: ScopeKey = params.scope === "all" ? "all" : "mine";

  const listFilters = {
    search: (params.q ?? "").trim(),
    sort: parseDealSort(params.sort),
    clientTypes: parseClientTypeFilters(params.type),
    markets: parseMarketFilters(params.market),
    salesReps: parseSalesRepFilters(params.salesRep),
    paymentStatuses: [] as PaymentStatus[],
    socketTypes: parseSocketTypeFilters(params.socket),
  };

  const baseWhere: Prisma.DealWhereInput = {
    stage: "WON",
    ...(payment !== "all" ? { paymentStatus: payment as PaymentStatus } : {}),
    ...(scope === "mine" ? { createdByUserId: session.user.id } : {}),
  };
  const where = buildDealListWhere(baseWhere, listFilters);
  const sortDirection = listFilters.sort === "date_asc" ? "asc" : "desc";

  const [totalDeals, salesRepRows, socketRows] = await Promise.all([
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

  const totalPages = Math.max(1, Math.ceil(totalDeals / LIST_PAGE_SIZE));
  const page = parseListPage(params.page, totalPages);

  const deals = await prisma.deal.findMany({
    where,
    orderBy: { wonAt: sortDirection },
    skip: (page - 1) * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE,
    include: { lineItems: true, boothUnits: true, client: { select: { isVip: true } } },
  });

  const pageHref = (target: number) =>
    buildDealListHref("/deals", urlState(payment, scope, listFilters, target), "deals");

  const filtersActive = hasDealListFilters(listFilters);
  const emptyMessage = filtersActive
    ? "No deals match these filters."
    : scope === "mine"
      ? "You have no won deals yet."
      : "No won deals here yet. Go smash that FUCK YEAH button.";

  return (
    <>
      <PageHeader
        title="Deals"
        description="Won deals, their payment status, and booth production progress."
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Link
            key={s.key}
            href={listHref(payment, s.key, listFilters)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              scope === s.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={listHref(f.key, scope, listFilters)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              payment === f.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <DealListToolbar
        basePath="/deals"
        variant="deals"
        search={listFilters.search}
        sort={listFilters.sort}
        selectedTypes={listFilters.clientTypes}
        selectedMarkets={listFilters.markets}
        selectedSalesReps={listFilters.salesReps}
        selectedPaymentStatuses={[]}
        selectedSocketTypes={listFilters.socketTypes}
        salesRepOptions={salesRepRows.map((row) => row.salesRep)}
        socketTypeOptions={mergeSocketTypeOptions(socketRows.map((row) => row.socketType))}
        scope={scope}
        dealsPaymentPill={payment}
      />

      {deals.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const total = dealTotalEur(deal);
            const statusCounts = deal.boothUnits.reduce<Record<string, number>>((acc, unit) => {
              acc[unit.status] = (acc[unit.status] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="block">
                <Card className="transition hover:border-brand-500/40 hover:shadow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{deal.dealId}</span>
                        <span className="text-sm text-slate-500">{deal.quoteNumber}</span>
                        <Badge tone={PAYMENT_TONES[deal.paymentStatus]}>
                          {PAYMENT_STATUS_LABELS[deal.paymentStatus]}
                        </Badge>
                        {deal.client?.isVip && <VipBadge />}
                        {deal.readyToAssemble && <Badge tone="green">Ready to assemble</Badge>}
                        {deal.sheetSyncError && <Badge tone="amber">Sheet sync failed</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {deal.clientName}
                        {deal.market && ` · ${deal.market}`}
                        {` · won ${formatDate(deal.wonAt)}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {Object.entries(statusCounts)
                          .map(
                            ([status, count]) =>
                              `${count} ${BOOTH_UNIT_STATUS_LABELS[status as keyof typeof BOOTH_UNIT_STATUS_LABELS].toLowerCase()}`,
                          )
                          .join(" · ") || "No booth units"}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">
                      {total == null ? "—" : formatMoney(total)}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}

          <ListPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalDeals}
            pageHref={pageHref}
            countLabel="deal"
          />
        </div>
      )}
    </>
  );
}
