import Link from "next/link";
import type { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  BOOTH_UNIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
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

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; page?: string }>;
}) {
  await requireSalesAccess();

  const params = await searchParams;
  const paymentParam = params.payment ?? "all";
  const payment = FILTERS.some((f) => f.key === paymentParam) ? paymentParam : "all";

  const where: Prisma.DealWhereInput = {
    stage: "WON",
    ...(payment !== "all" ? { paymentStatus: payment as PaymentStatus } : {}),
  };

  const totalDeals = await prisma.deal.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalDeals / LIST_PAGE_SIZE));
  const page = parseListPage(params.page, totalPages);

  const deals = await prisma.deal.findMany({
    where,
    orderBy: { wonAt: "desc" },
    skip: (page - 1) * LIST_PAGE_SIZE,
    take: LIST_PAGE_SIZE,
    include: { lineItems: true, boothUnits: true, client: { select: { isVip: true } } },
  });

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (payment !== "all") query.set("payment", payment);
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `/deals?${qs}` : "/deals";
  };

  const filterHref = (key: string) => {
    if (key === "all") return "/deals";
    return `/deals?payment=${key}`;
  };

  return (
    <>
      <PageHeader
        title="Deals"
        description="Won deals, their payment status, and booth production progress."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
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

      {deals.length === 0 ? (
        <EmptyState>No won deals here yet. Go smash that FUCK YEAH button.</EmptyState>
      ) : (
        <div className="space-y-3">
          {deals.map((deal) => {
            const total = deal.lineItems.reduce(
              (sum, li) => sum + li.quantity * Number(li.unitPrice),
              0,
            );
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
                      {formatMoney(total, deal.currency)}
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
