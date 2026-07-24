import Link from "next/link";
import { dealTotalEur } from "@/lib/line-item-eur";
import { dealSubtotal } from "@/lib/vat";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { listParentCompanyOptions } from "@/app/actions/clients";
import {
  DEAL_STAGE_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import {
  clientHierarchyRole,
  isClientVip,
  sumClientStats,
} from "@/lib/client-hierarchy";
import { loadClientStatsByClient } from "@/lib/client-stats";
import { Badge, Card, EmptyState, PageHeader, VipBadge } from "@/components/ui";
import { ClientForm } from "@/components/client-form";
import { ClientDeleteButton } from "@/components/client-delete-button";

export const dynamic = "force-dynamic";

const STAGE_TONES = { QUOTE: "blue", WON: "green", LOST: "red" } as const;

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSalesAccess();

  const { id } = await params;
  const [client, user] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, isVip: true } },
        subsidiaries: {
          orderBy: { name: "asc" },
          include: { _count: { select: { deals: true } } },
        },
        contacts: { orderBy: { sortOrder: "asc" } },
        deals: {
          orderBy: { createdAt: "desc" },
          include: { lineItems: { select: { quantity: true, unitPrice: true, unitPriceEur: true } } },
        },
        _count: { select: { subsidiaries: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user!.id },
      select: { systemRole: true },
    }),
  ]);
  if (!client) notFound();

  const isAdmin = user?.systemRole === "ADMIN";
  const role = clientHierarchyRole(client, client._count.subsidiaries);
  const isParent = role === "parent";
  const showVip = isClientVip(client, client.parent);

  // Two aggregate queries cover this record plus every subsidiary.
  const subsidiaryIds = client.subsidiaries.map((sub) => sub.id);
  const [statsById, parentOptions] = await Promise.all([
    loadClientStatsByClient([client.id, ...subsidiaryIds]),
    listParentCompanyOptions(client.id),
  ]);

  const rollupStats = isParent
    ? sumClientStats(statsById, [client.id, ...subsidiaryIds])
    : (statsById.get(client.id) ?? { revenue: 0, won: 0, openQuotes: 0 });

  const subsidiaryStats = client.subsidiaries.map((sub) => ({
    sub,
    stats: statsById.get(sub.id) ?? { revenue: 0, won: 0, openQuotes: 0 },
  }));

  const wonDeals = client.deals.filter((d) => d.stage === "WON");
  const openQuotes = client.deals.filter((d) => d.stage === "QUOTE");
  // Deals with an unknown EUR total (legacy non-EUR rows) contribute 0 here,
  // matching the SQL rollup in client-hierarchy.ts.
  const localRevenue = wonDeals.reduce((sum, deal) => sum + (dealTotalEur(deal) ?? 0), 0);

  return (
    <>
      <PageHeader
        title={client.name}
        description={
          role === "subsidiary" && client.parent
            ? `${client.parent.name} subsidiary`
            : "Client details, stats, and deal history."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {showVip && <VipBadge />}
          {role === "parent" && <Badge tone="blue">Group account</Badge>}
          {role === "subsidiary" && client.parent && (
            <Link
              href={`/clients/${client.parent.id}`}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              ← {client.parent.name}
            </Link>
          )}
          <Link
            href="/clients"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            All clients
          </Link>
        </div>
      </PageHeader>

      {role === "subsidiary" && client.parent && (
        <p className="mb-4 text-sm text-slate-600">
          <Link href={`/clients/${client.parent.id}`} className="font-medium text-brand-700 hover:underline">
            {client.parent.name}
          </Link>
          {" → "}
          <span className="text-slate-900">{client.name}</span>
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">
            {isParent ? "Group revenue (won)" : "Total revenue (won)"}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatMoney(isParent ? rollupStats.revenue : localRevenue)}
          </p>
          {isParent && localRevenue > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Includes {formatMoney(localRevenue)} on this record (legacy)
            </p>
          )}
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{isParent ? "Group won deals" : "Won deals"}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {isParent ? rollupStats.won : wonDeals.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{isParent ? "Group open quotes" : "Open quotes"}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {isParent ? rollupStats.openQuotes : openQuotes.length}
          </p>
        </Card>
      </div>

      {isParent && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Subsidiaries</h2>
            <Link
              href={`/clients?view=subsidiaries`}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all subsidiaries
            </Link>
          </div>
          {client.subsidiaries.length === 0 ? (
            <EmptyState>
              No subsidiaries yet. Edit this client and add local companies as subsidiaries, or
              create a new client and assign this group as the parent company.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {subsidiaryStats.map(({ sub, stats }) => (
                <Link key={sub.id} href={`/clients/${sub.id}`} className="block">
                  <Card className="transition hover:border-brand-500/40 hover:shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{sub.name}</p>
                        <p className="text-sm text-slate-600">
                          {[sub.market, sub.vatNumber].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">{formatMoney(stats.revenue)}</p>
                        <p>
                          {stats.won} deal{stats.won === 1 ? "" : "s"} · {sub._count.deals} total
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        <ClientForm
          clientId={client.id}
          isGroupHead={isParent}
          parentOptions={parentOptions}
          initialValues={{
            name: client.name,
            registeredAddress: client.registeredAddress,
            vatNumber: client.vatNumber,
            clientType: client.clientType,
            market: client.market,
            website: client.website,
            isVip: client.isVip,
            parentClientId: client.parentClientId,
            isGroupAccount: isParent,
            contacts: client.contacts.map((c) => ({
              kind: c.kind,
              name: c.name,
              email: c.email,
              phone: c.phone,
              role: c.role,
            })),
          }}
        />

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            {isParent ? "Deals on this record" : "Quotes & deals"}
          </h2>
          {isParent && (
            <p className="text-sm text-slate-500">
              Quotes are linked to subsidiaries. Group totals above include all subsidiary deals.
            </p>
          )}
          {client.deals.length === 0 ? (
            <EmptyState>
              {isParent
                ? "No deals on the group record. Create quotes on a subsidiary instead."
                : "No quotes for this client yet."}
            </EmptyState>
          ) : (
            client.deals.map((deal) => {
              const totalEur = dealTotalEur(deal);
              const displayTotal =
                deal.stage === "WON"
                  ? totalEur == null
                    ? "—"
                    : formatMoney(totalEur)
                  : formatMoney(dealSubtotal(deal), deal.currency);
              const href = deal.stage === "WON" ? `/deals/${deal.id}` : `/quotes/${deal.id}`;
              return (
                <Link key={deal.id} href={href} className="block">
                  <Card className="transition hover:border-brand-500/40 hover:shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{deal.quoteNumber}</span>
                          {deal.dealId && (
                            <span className="text-sm text-slate-500">Deal {deal.dealId}</span>
                          )}
                          <Badge tone={STAGE_TONES[deal.stage]}>
                            {DEAL_STAGE_LABELS[deal.stage]}
                          </Badge>
                          {deal.stage === "WON" && (
                            <Badge tone="slate">
                              {PAYMENT_STATUS_LABELS[deal.paymentStatus]}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(deal.dealDate)}
                          {deal.salesRep && ` · ${deal.salesRep}`}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">{displayTotal}</p>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-8 flex justify-end border-t border-slate-200 pt-6">
          <ClientDeleteButton clientId={client.id} clientName={client.name} />
        </div>
      )}
    </>
  );
}
