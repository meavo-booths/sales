import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { DEAL_STAGE_LABELS } from "@/lib/deal-values";
import { Badge, PageHeader, VipBadge } from "@/components/ui";
import {
  AssemblyAddressCard,
  ContactsCard,
  DealDetailsCard,
  LineItemsCard,
  NotesCard,
} from "@/components/deal-sections";
import { ConvertQuoteButton } from "@/components/convert-quote";
import { QuoteSecondaryActions } from "@/components/quote-actions";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSalesAccess();

  const { id } = await params;
  const quote = await prisma.deal.findUnique({
    where: { id },
    include: {
      contacts: true,
      lineItems: { include: { product: true } },
      client: { select: { isVip: true } },
    },
  });
  if (!quote) notFound();
  if (quote.stage === "WON") redirect(`/deals/${quote.id}`);

  const isOpen = quote.stage === "QUOTE";

  return (
    <>
      <PageHeader
        title={`Quote ${quote.quoteNumber}`}
        description={quote.clientName}
      >
        <div className="flex flex-wrap items-center gap-2">
          {quote.client?.isVip && <VipBadge />}
          <Badge tone={isOpen ? "blue" : "red"}>{DEAL_STAGE_LABELS[quote.stage]}</Badge>
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Download PDF
          </a>
          {isOpen && (
            <>
              <Link
                href={`/quotes/${quote.id}/edit`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </Link>
              <ConvertQuoteButton quoteId={quote.id} />
            </>
          )}
        </div>
      </PageHeader>

      <div className="space-y-6">
        <DealDetailsCard deal={quote} />
        <div className="grid gap-6 lg:grid-cols-2">
          <AssemblyAddressCard deal={quote} />
          <NotesCard deal={quote} />
        </div>
        <ContactsCard deal={quote} />
        <LineItemsCard deal={quote} />
        {isOpen && <QuoteSecondaryActions quoteId={quote.id} />}
      </div>
    </>
  );
}
