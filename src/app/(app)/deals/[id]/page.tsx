import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess, hasTasksAccess } from "@/lib/meavo-auth";
import { BOOTH_FAMILY_LABELS, FINISH_LABELS } from "@/lib/deal-values";
import { Card, PageHeader } from "@/components/ui";
import {
  AssemblyAddressCard,
  ContactsCard,
  DealDetailsCard,
  LineItemsCard,
  NotesCard,
} from "@/components/deal-sections";
import {
  BoothUnitEditor,
  CreateXeroFinalInvoiceButton,
  DealDeleteButton,
  DealPaymentCard,
  RetrySheetSyncButton,
  RetryXeroInvoiceButton,
  RetryZampSyncButton,
} from "@/components/deal-editors";
import { DealPageActions } from "@/components/deal-page-actions";
import { DealLifecycleStrip, DealSummaryBar, type BoothSummaryItem } from "@/components/deal-summary";
import { dealSubtotal, dealTotals } from "@/lib/vat";
import { persistedUsTaxAmount } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";
import { fetchXeroPaymentBreakdown } from "@/lib/xero/sync-payment";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSalesAccess();

  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
      lineItems: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      boothUnits: { include: { product: true }, orderBy: { createdAt: "asc" } },
      client: { select: { isVip: true } },
    },
  });
  if (!deal) notFound();
  if (deal.stage !== "WON" || !deal.dealId) redirect(`/quotes/${deal.id}`);

  const assemblies = await prisma.assembly.findMany({
    where: { OR: [{ linkedDealId: deal.dealId }, { dealId: deal.dealId }] },
    select: { dealId: true, eventType: true, assemblyDate: true },
    orderBy: { createdAt: "asc" },
  });

  const showAddTask = await hasTasksAccess(session.user!.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { systemRole: true },
  });
  const isAdmin = user?.systemRole === "ADMIN";

  const totals = dealTotals(dealSubtotal(deal), deal.market, {
    salesTaxAmount: persistedUsTaxAmount(deal),
  });

  const hasSyncAlerts =
    Boolean(deal.sheetSyncError) ||
    Boolean(deal.xeroSyncError) ||
    Boolean(deal.xeroFinalSyncError) ||
    (isUsMarket(deal.market) && Boolean(deal.zampSyncError));

  const showCreateXeroInvoice = !deal.xeroInvoiceId;
  const showCreateXeroFinalInvoice =
    deal.paymentTerms === "SPLIT_50_50" && Boolean(deal.xeroInvoiceId) && !deal.xeroFinalInvoiceId;
  const createInvoiceLabel = deal.xeroSyncError ? "Retry Xero invoice" : "Create invoice";

  const boothCounts = new Map<string, number>();
  for (const item of deal.lineItems) {
    if (item.product?.kind !== "BOOTH") continue;
    const label = item.product.boothFamily
      ? BOOTH_FAMILY_LABELS[item.product.boothFamily]
      : item.product.name;
    boothCounts.set(label, (boothCounts.get(label) ?? 0) + item.quantity);
  }
  const booths: BoothSummaryItem[] = [...boothCounts.entries()].map(([label, qty]) => ({
    label,
    qty,
  }));

  const xeroPaymentBreakdown =
    deal.xeroPaymentSyncedAt && deal.xeroInvoiceId
      ? await fetchXeroPaymentBreakdown(deal.id)
      : null;

  return (
    <>
      <PageHeader title={`Deal ${deal.dealId}`}>
        <DealPageActions
          dealDbId={deal.id}
          dealBusinessId={deal.dealId}
          clientName={deal.clientName}
          readyToAssemble={deal.readyToAssemble}
          assemblies={assemblies}
          showAddTask={showAddTask}
          showCreateInvoice={showCreateXeroInvoice}
          createInvoiceLabel={createInvoiceLabel}
          showCreateFinalInvoice={showCreateXeroFinalInvoice}
        />
      </PageHeader>

      <DealSummaryBar
        dealId={deal.dealId}
        quoteNumber={deal.quoteNumber}
        clientName={deal.clientName}
        isVip={deal.client?.isVip ?? false}
        currency={deal.currency}
        totalExclTax={totals.subtotal}
        taxLabel={totals.taxLabel}
        paymentStatus={deal.paymentStatus}
        wonAt={deal.wonAt}
        targetDeliveryDate={deal.targetDeliveryDate}
        paymentPoDate={deal.paymentPoDate}
        market={deal.market}
        deliveryType={deal.deliveryType}
        paymentTerms={deal.paymentTerms}
        booths={booths}
      />

      <DealLifecycleStrip
        sheetSyncedAt={deal.sheetSyncedAt}
        sheetSyncError={deal.sheetSyncError}
        xeroInvoiceId={deal.xeroInvoiceId}
        xeroSyncError={deal.xeroSyncError}
        xeroFinalInvoiceId={deal.xeroFinalInvoiceId}
        xeroFinalSyncError={deal.xeroFinalSyncError}
        paymentTerms={deal.paymentTerms}
        zampSyncedAt={deal.zampSyncedAt}
        zampSyncError={deal.zampSyncError}
        showZamp={isUsMarket(deal.market)}
        paymentStatus={deal.paymentStatus}
        readyToAssemble={deal.readyToAssemble}
        xeroPaymentBreakdown={xeroPaymentBreakdown}
      />

      <div className="space-y-6">
        {hasSyncAlerts && (
          <div id="deal-sync-alerts" className="space-y-4 scroll-mt-4">
            {deal.sheetSyncError && (
              <Card className="border-amber-300 bg-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-900">Ops File sync failed</p>
                    <p className="text-sm text-amber-800">{deal.sheetSyncError}</p>
                  </div>
                  <RetrySheetSyncButton dealId={deal.id} />
                </div>
              </Card>
            )}
            {deal.xeroSyncError && (
              <Card className="border-amber-300 bg-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-900">Xero invoice not created</p>
                    <p className="text-sm text-amber-800">{deal.xeroSyncError}</p>
                  </div>
                  <RetryXeroInvoiceButton dealId={deal.id} />
                </div>
              </Card>
            )}
            {deal.xeroFinalSyncError && (
              <Card className="border-amber-300 bg-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-900">Xero final invoice not created</p>
                    <p className="text-sm text-amber-800">{deal.xeroFinalSyncError}</p>
                  </div>
                  <CreateXeroFinalInvoiceButton dealId={deal.id} />
                </div>
              </Card>
            )}
            {isUsMarket(deal.market) && deal.zampSyncError && (
              <Card className="border-amber-300 bg-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-900">Zamp sync failed</p>
                    <p className="text-sm text-amber-800">{deal.zampSyncError}</p>
                  </div>
                  <RetryZampSyncButton dealId={deal.id} />
                </div>
              </Card>
            )}
          </div>
        )}

        <Card className="!p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Booth units ({deal.boothUnits.length})
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  One per physical booth — manufacturing assigns these from the warehouse or the
                  production backlog.
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-slate-500 transition group-open:hidden">
                Show
              </span>
              <span className="hidden shrink-0 text-sm font-medium text-slate-500 transition group-open:inline">
                Hide
              </span>
            </summary>
            <div className="border-t border-slate-100 p-4 sm:p-6">
              {deal.boothUnits.length === 0 ? (
                <p className="text-sm text-slate-500">No booth units.</p>
              ) : (
                <ul className="space-y-2">
                  {deal.boothUnits.map((unit, index) => (
                    <li
                      key={unit.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          #{index + 1} {unit.product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {FINISH_LABELS[unit.finish]}
                          {unit.finishDetails && ` · ${unit.finishDetails}`}
                        </p>
                      </div>
                      <BoothUnitEditor
                        unitId={unit.id}
                        status={unit.status}
                        location={unit.location}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </Card>

        <DealDetailsCard deal={deal} />

        <div className="grid gap-6 lg:grid-cols-2">
          <AssemblyAddressCard deal={deal} />
          <NotesCard deal={deal} />
        </div>

        <ContactsCard deal={deal} />

        <LineItemsCard deal={deal} />

        <DealPaymentCard
          dealId={deal.id}
          paymentStatus={deal.paymentStatus}
          paymentPoDate={deal.paymentPoDate?.toISOString().slice(0, 10) ?? ""}
          paymentTerms={deal.paymentTerms}
          xeroPaymentSyncedAt={deal.xeroPaymentSyncedAt?.toISOString() ?? null}
          xeroInvoiceId={deal.xeroInvoiceId}
          xeroPaymentBreakdown={xeroPaymentBreakdown}
        />

        {isAdmin && (
          <div className="flex justify-end border-t border-slate-200 pt-6">
            <DealDeleteButton dealId={deal.id} />
          </div>
        )}
      </div>
    </>
  );
}
