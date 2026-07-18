import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { PageHeader } from "@/components/ui";
import {
  DealContactsEditorCard,
  DealDeliveryNotesCard,
  DealDetailsEditorCard,
} from "@/components/deal-editors";

export const dynamic = "force-dynamic";

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSalesAccess();

  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!deal) notFound();
  if (deal.stage !== "WON" || !deal.dealId) redirect(`/quotes/${deal.id}`);

  return (
    <>
      <PageHeader title={`Edit deal ${deal.dealId}`} description={deal.clientName}>
        <Link
          href={`/deals/${deal.id}`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Done
        </Link>
      </PageHeader>

      <div className="space-y-6">
        <DealDetailsEditorCard
          dealId={deal.id}
          defaultEditing
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
            deliveryType: deal.deliveryType ?? "",
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

        <DealContactsEditorCard
          dealId={deal.id}
          defaultEditing
          contacts={deal.contacts.map((contact) => ({
            kind: contact.kind,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            role: contact.role,
          }))}
        />
      </div>
    </>
  );
}
