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
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) notFound();
  if (quote.stage !== "QUOTE") redirect(`/quotes/${quote.id}`);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const initialValues: QuoteFormValues = {
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
    lineItems: quote.lineItems.map((li) => ({
      productId: li.productId,
      quantity: li.quantity,
      unitPrice: Number(li.unitPrice),
      finish: li.finish,
      finishDetails: li.finishDetails,
      description: li.description,
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
          listPrice: Number(p.listPrice),
        }))}
        initialValues={initialValues}
      />
    </>
  );
}
