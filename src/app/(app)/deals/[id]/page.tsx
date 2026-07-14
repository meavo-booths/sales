import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess, hasTasksAccess } from "@/lib/meavo-auth";
import { FINISH_LABELS } from "@/lib/deal-values";
import { Card, PageHeader } from "@/components/ui";
import { LineItemsCard } from "@/components/deal-sections";
import {
  BoothUnitEditor,
  DealDeliveryNotesCard,
  DealDetailsEditorCard,
  DealPeopleBillingCard,
  RetrySheetSyncButton,
  RetryXeroInvoiceButton,
  RetryZampSyncButton,
} from "@/components/deal-editors";
import { DealPageActions } from "@/components/deal-page-actions";
import { DealLifecycleStrip, DealSummaryBar } from "@/components/deal-summary";
import { dealSubtotal, dealTotals } from "@/lib/vat";
import { persistedUsTaxAmount } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";

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
    (isUsMarket(deal.market) && Boolean(deal.zampSyncError));

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
          isAdmin={isAdmin}
        />
      </PageHeader>

      <DealSummaryBar
        dealId={deal.dealId}
        quoteNumber={deal.quoteNumber}
        clientName={deal.clientName}
        isVip={deal.client?.isVip ?? false}
        currency={deal.currency}
        totalInclTax={totals.totalInclVat}
        taxLabel={totals.taxLabel}
        paymentStatus={deal.paymentStatus}
        wonAt={deal.wonAt}
        targetDeliveryDate={deal.targetDeliveryDate}
        paymentPoDate={deal.paymentPoDate}
        market={deal.market}
        paymentTerms={deal.paymentTerms}
      />

      <DealLifecycleStrip
        sheetSyncedAt={deal.sheetSyncedAt}
        sheetSyncError={deal.sheetSyncError}
        xeroInvoiceId={deal.xeroInvoiceId}
        xeroSyncError={deal.xeroSyncError}
        zampSyncedAt={deal.zampSyncedAt}
        zampSyncError={deal.zampSyncError}
        showZamp={isUsMarket(deal.market)}
        paymentStatus={deal.paymentStatus}
        readyToAssemble={deal.readyToAssemble}
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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <DealDetailsEditorCard
              dealId={deal.id}
              details={{
                dealDate: deal.dealDate.toISOString().slice(0, 10),
                salesRep: deal.salesRep,
                market: deal.market,
                usState: deal.usState,
                shipToLine1: deal.shipToLine1,
                shipToLine2: deal.shipToLine2,
                shipToCity: deal.shipToCity,
                shipToZip: deal.shipToZip,
                clientName: deal.clientName,
                clientType: deal.clientType,
                paymentTerms: deal.paymentTerms,
                vatNumber: deal.vatNumber,
                registeredAddress: deal.registeredAddress,
                website: deal.website,
                socketType: deal.socketType,
                targetDeliveryDate: deal.targetDeliveryDate?.toISOString().slice(0, 10) ?? "",
              }}
            />

            <DealDeliveryNotesCard
              dealId={deal.id}
              values={{
                assemblyAddress: deal.assemblyAddress,
                notes: deal.notes,
                clientPo: deal.clientPo,
                actualClient: deal.actualClient,
              }}
            />
          </div>

          <DealPeopleBillingCard
            dealId={deal.id}
            contacts={deal.contacts.map((contact) => ({
              kind: contact.kind,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              role: contact.role,
            }))}
            paymentStatus={deal.paymentStatus}
            paymentPoDate={deal.paymentPoDate?.toISOString().slice(0, 10) ?? ""}
          />
        </div>

        <LineItemsCard deal={deal} />

        <Card>
          <h2 className="mb-1 text-base font-semibold text-slate-900">Booth units</h2>
          <p className="mb-4 text-sm text-slate-600">
            One per physical booth — manufacturing assigns these from the warehouse or the
            production backlog.
          </p>
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
        </Card>
      </div>
    </>
  );
}
