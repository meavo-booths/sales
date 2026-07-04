import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  DEAL_STAGE_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const dynamic = "force-dynamic";

const STAGE_TONES = { QUOTE: "blue", WON: "green", LOST: "red" } as const;

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSalesAccess();

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
      deals: {
        orderBy: { createdAt: "desc" },
        include: { lineItems: { select: { quantity: true, unitPrice: true } } },
      },
    },
  });
  if (!client) notFound();

  const wonDeals = client.deals.filter((d) => d.stage === "WON");
  const openQuotes = client.deals.filter((d) => d.stage === "QUOTE");
  const revenue = wonDeals.reduce(
    (sum, deal) =>
      sum + deal.lineItems.reduce((s, li) => s + li.quantity * Number(li.unitPrice), 0),
    0,
  );

  return (
    <>
      <PageHeader title={client.name} description="Client details, stats, and deal history.">
        <div className="flex items-center gap-2">
          {client.isVip && <Badge tone="violet">VIP</Badge>}
          <Link
            href="/clients"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ← All clients
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Total revenue (won)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(revenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Won deals</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{wonDeals.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Open quotes</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{openQuotes.length}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Quotes & deals</h2>
          {client.deals.length === 0 ? (
            <EmptyState>No quotes for this client yet.</EmptyState>
          ) : (
            client.deals.map((deal) => {
              const total = deal.lineItems.reduce(
                (sum, li) => sum + li.quantity * Number(li.unitPrice),
                0,
              );
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
                      <p className="font-semibold text-slate-900">
                        {formatMoney(total, deal.currency)}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <div>
          <ClientForm
            clientId={client.id}
            initialValues={{
              name: client.name,
              registeredAddress: client.registeredAddress,
              vatNumber: client.vatNumber,
              clientType: client.clientType,
              market: client.market,
              website: client.website,
              isVip: client.isVip,
              contacts: client.contacts.map((c) => ({
                kind: c.kind,
                name: c.name,
                email: c.email,
                phone: c.phone,
                role: c.role,
              })),
            }}
          />
        </div>
      </div>
    </>
  );
}
