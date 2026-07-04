import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { CLIENT_TYPE_LABELS, formatMoney } from "@/lib/deal-values";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/client-form";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSalesAccess();

  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const where: Prisma.ClientWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const clients = await prisma.client.findMany({
    where,
    orderBy: [{ isVip: "desc" }, { name: "asc" }],
    include: {
      deals: {
        select: {
          stage: true,
          lineItems: { select: { quantity: true, unitPrice: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader title="Clients" description="Client directory with deal history and stats." />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <form method="GET" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search clients…"
              className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Search
            </button>
          </form>

          {clients.length === 0 ? (
            <EmptyState>
              {search ? `No clients matching “${search}”.` : "No clients yet. Add your first client."}
            </EmptyState>
          ) : (
            clients.map((client) => {
              const won = client.deals.filter((d) => d.stage === "WON");
              const openQuotes = client.deals.filter((d) => d.stage === "QUOTE").length;
              const revenue = won.reduce(
                (sum, deal) =>
                  sum +
                  deal.lineItems.reduce((s, li) => s + li.quantity * Number(li.unitPrice), 0),
                0,
              );
              return (
                <Link key={client.id} href={`/clients/${client.id}`} className="block">
                  <Card className="transition hover:border-brand-500/40 hover:shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{client.name}</span>
                          {client.isVip && <Badge tone="violet">VIP</Badge>}
                          <Badge tone="slate">{CLIENT_TYPE_LABELS[client.clientType]}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {[client.market, client.website].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatMoney(revenue)}</p>
                        <p className="text-sm text-slate-500">
                          {won.length} deal{won.length === 1 ? "" : "s"} · {openQuotes} open quote
                          {openQuotes === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
        <div>
          <ClientForm />
        </div>
      </div>
    </>
  );
}
