import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  CLIENT_TYPE_LABELS,
  DEAL_STAGE_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STAGE_TONES = { QUOTE: "blue", WON: "green", LOST: "red" } as const;

const FILTERS = [
  { key: "open", label: "Open quotes" },
  { key: "all", label: "All" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function stageWhere(filter: FilterKey): Prisma.DealWhereInput {
  if (filter === "open") return { stage: "QUOTE" };
  if (filter === "won") return { stage: "WON" };
  if (filter === "lost") return { stage: "LOST" };
  return {};
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireSalesAccess();

  const params = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === params.filter)
    ? (params.filter as FilterKey)
    : "open";

  const quotes = await prisma.deal.findMany({
    where: stageWhere(filter),
    orderBy: { createdAt: "desc" },
    include: { lineItems: true },
  });

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

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/" : `/?filter=${f.key}`}
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
        <EmptyState>No quotes here yet. Create your first quote.</EmptyState>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const total = quote.lineItems.reduce(
              (sum, li) => sum + li.quantity * Number(li.unitPrice),
              0,
            );
            const booths = quote.lineItems.reduce((sum, li) => sum + li.quantity, 0);
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
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {quote.clientName}
                        {quote.market && ` · ${quote.market}`}
                        {` · ${CLIENT_TYPE_LABELS[quote.clientType]}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {formatMoney(total, quote.currency)}
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
        </div>
      )}
    </>
  );
}
