import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { PageHeader } from "@/components/ui";
import { QuoteForm, type QuoteFormValues } from "@/components/quote-form";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSalesAccess();

  const { id } = await params;
  const quote = await prisma.deal.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
      lineItems: { orderBy: { sortOrder: "asc" }, include: { product: true } },
    },
  });
  if (!quote) notFound();
  if (quote.stage !== "QUOTE") redirect(`/quotes/${quote.id}`);

  const [products, clients] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: { addOnRestrictions: { select: { boothId: true } } },
    }),
    prisma.client.findMany({
      orderBy: [{ isVip: "desc" }, { name: "asc" }],
      include: { contacts: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  const boothLines = quote.lineItems.filter((li) => li.product.kind === "BOOTH");
  const addOnLines = quote.lineItems.filter((li) => li.product.kind === "ADDON");

  const initialValues: QuoteFormValues = {
    clientId: quote.clientId,
    dealDate: quote.dealDate.toISOString().slice(0, 10),
    salesRep: quote.salesRep,
    market: quote.market,
    clientName: quote.clientName,
    registeredAddress: quote.registeredAddress,
    vatNumber: quote.vatNumber,
    clientType: quote.clientType,
    paymentTerms: quote.paymentTerms,
    notes: quote.notes,
    contacts: quote.contacts.map((c) => ({
      kind: c.kind,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
    })),
    lineItems: boothLines.map((li) => ({
      productId: li.productId,
      quantity: li.quantity,
      unitPrice: Number(li.unitPrice),
      finish: li.finish,
      finishDetails: li.finishDetails,
      description: li.description,
      addOns: addOnLines
        .filter((addOn) => addOn.parentLineItemId === li.id)
        .map((addOn) => ({
          productId: addOn.productId,
          quantity: addOn.quantity,
          unitPrice: Number(addOn.unitPrice),
          description: addOn.description,
        })),
    })),
    standaloneAddOns: addOnLines
      .filter((addOn) => !addOn.parentLineItemId)
      .map((addOn) => ({
        productId: addOn.productId,
        quantity: addOn.quantity,
        unitPrice: Number(addOn.unitPrice),
        description: addOn.description,
      })),
  };

  return (
    <>
      <PageHeader title={`Edit ${quote.quoteNumber}`} description={quote.clientName} />
      <QuoteForm
        quoteId={quote.id}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          kind: p.kind,
          listPrice: Number(p.listPrice),
          restrictedToBoothIds: p.addOnRestrictions.map((r) => r.boothId),
        }))}
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          registeredAddress: c.registeredAddress,
          vatNumber: c.vatNumber,
          clientType: c.clientType,
          market: c.market,
          isVip: c.isVip,
          contacts: c.contacts.map((contact) => ({
            kind: contact.kind,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            role: contact.role,
          })),
        }))}
        initialValues={initialValues}
      />
    </>
  );
}
