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

function buildQueryParams(filter: FilterKey, scope: ScopeKey, page?: number): URLSearchParams {
  const query = new URLSearchParams();
  if (scope === "all") query.set("scope", "all");
  if (filter !== "open") query.set("filter", filter);
  if (page && page > 1) query.set("page", String(page));
  return query;
}

function listHref(filter: FilterKey, scope: ScopeKey): string {
  const qs = buildQueryParams(filter, scope).toString();
  return qs ? `/?${qs}` : "/";
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; scope?: string; page?: string }>;
}) {
  const session = await requireSalesAccess();

  const params = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as FilterKey)
    : "open";
  const scope: ScopeKey = params.scope === "all" ? "all" : "mine";

  const where: Prisma.DealWhereInput = {
    ...stageWhere(filter),
    ...(scope === "mine" ? { createdByUserId: session.user.id } : {}),
  };
  const totalQuotes = await prisma.deal.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalQuotes / LIST_PAGE_SIZE));
  const page = parseListPage(params.page, totalPages);

  const quotes = await prisma.deal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE,
    include: {
      lineItems: { include: { product: { select: { kind: true } } } },
      client: { select: { isVip: true } },
    },
  });

  const pageHref = (target: number) => {
    const qs = buildQueryParams(filter, scope, target).toString();
    return qs ? `/?${qs}` : "/";
  };

  const emptyMessage =
    filter === "open"
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

      <div className="mb-3 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Link
            key={s.key}
            href={listHref(filter, s.key)}
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
            href={listHref(f.key, scope)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              filter === f.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

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
    </>
  );
}
