import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { ASSEMBLY_URL } from "@/lib/constants";
import {
  FINISH_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
} from "@/lib/deal-values";
import { Badge, Card, PageHeader, VipBadge } from "@/components/ui";
import { LineItemsCard } from "@/components/deal-sections";
import {
  AssemblyAndNotesEditorRow,
  BoothUnitEditor,
  DealContactsEditorCard,
  DealDetailsEditorCard,
  PaymentEditor,
  ReadyToAssembleToggle,
  RetrySheetSyncButton,
  RetryXeroInvoiceButton,
} from "@/components/deal-editors";

export const dynamic = "force-dynamic";

const PAYMENT_TONES = { UNPAID: "red", PARTIALLY_PAID: "amber", PAID: "green" } as const;

const ASSEMBLY_EVENT_LABELS: Record<string, string> = {
  ASSEMBLY: "Assembly",
  REPAIR: "Repair",
  MOVING_SERVICE: "Moving service",
  AFTERCARE: "Aftercare",
  INFO: "Info",
};

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSalesAccess();

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

  // Linked assemblies: linkedDealId is the app-created link; the exact dealId
  // match keeps legacy sheet-imported assemblies (named after the DealID) visible.
  const assemblies = await prisma.assembly.findMany({
    where: { OR: [{ linkedDealId: deal.dealId }, { dealId: deal.dealId }] },
    select: { dealId: true, eventType: true, assemblyDate: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader title={`Deal ${deal.dealId}`} description={deal.clientName}>
        <div className="flex flex-wrap items-center gap-2">
          {deal.client?.isVip && <VipBadge />}
          <Badge tone={PAYMENT_TONES[deal.paymentStatus]}>
            {PAYMENT_STATUS_LABELS[deal.paymentStatus]}
          </Badge>
          <span className="text-sm text-slate-500">
            {deal.quoteNumber} · won {formatDate(deal.wonAt)}
          </span>
          <a
            href={`/api/quotes/${deal.id}/pdf`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Quote PDF
          </a>
          {assemblies.map((assembly) => (
            <a
              key={assembly.dealId}
              href={`${ASSEMBLY_URL}/assemblies/${encodeURIComponent(assembly.dealId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {ASSEMBLY_EVENT_LABELS[assembly.eventType] ?? assembly.eventType}:{" "}
              {assembly.dealId} ↗
            </a>
          ))}
          <ReadyToAssembleToggle dealId={deal.id} ready={deal.readyToAssemble} />
        </div>
      </PageHeader>

      <div className="space-y-6">
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
        {(deal.sheetSyncedAt || deal.xeroInvoiceId) && (
          <p className="text-xs text-slate-500">
            {[
              deal.sheetSyncedAt && `Synced to the Ops File on ${formatDate(deal.sheetSyncedAt)}.`,
              deal.xeroInvoiceId &&
                `Xero draft invoice ${deal.xeroInvoiceNumber || "created"}${
                  deal.xeroSyncedAt ? ` on ${formatDate(deal.xeroSyncedAt)}` : ""
                }.`,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}

        <DealDetailsEditorCard
          dealId={deal.id}
          details={{
            dealDate: deal.dealDate.toISOString().slice(0, 10),
            salesRep: deal.salesRep,
            market: deal.market,
            usState: deal.usState,
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

        <AssemblyAndNotesEditorRow
          dealId={deal.id}
          values={{
            assemblyAddress: deal.assemblyAddress,
            notes: deal.notes,
            clientPo: deal.clientPo,
            actualClient: deal.actualClient,
          }}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <DealContactsEditorCard
            dealId={deal.id}
            contacts={deal.contacts.map((contact) => ({
              kind: contact.kind,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              role: contact.role,
            }))}
          />
          <Card>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Payment</h2>
            <PaymentEditor
              dealId={deal.id}
              paymentStatus={deal.paymentStatus}
              paymentPoDate={deal.paymentPoDate?.toISOString().slice(0, 10) ?? ""}
            />
          </Card>
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
