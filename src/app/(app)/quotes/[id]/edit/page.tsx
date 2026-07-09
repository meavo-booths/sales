import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { mapClientsForQuotePicker } from "@/lib/client-hierarchy";
import { parseProductCurrency } from "@/lib/exchange-rates";
import { PageHeader } from "@/components/ui";
import { QuoteForm, type QuoteFormValues } from "@/components/quote-form";

export const dynamic = "force-dynamic";

const productInclude = {
  familyRestrictions: { select: { boothFamily: true } },
  availability: { select: { market: true, clientType: true } },
} as const;

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSalesAccess();

  const { id } = await params;
  const quote = await prisma.deal.findUnique({
    where: { id },
    include: {
      client: { select: { isVip: true } },
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
      include: productInclude,
    }),
    prisma.client.findMany({
      orderBy: [{ isVip: "desc" }, { name: "asc" }],
      include: {
        parent: { select: { name: true, isVip: true } },
        contacts: { orderBy: { sortOrder: "asc" } },
        _count: { select: { subsidiaries: true } },
      },
    }),
  ]);

  const boothLines = quote.lineItems.filter((li) => li.product?.kind === "BOOTH");
  const addOnLines = quote.lineItems.filter((li) => li.product?.kind === "ADDON");
  const customLines = quote.lineItems.filter((li) => !li.productId);

  const initialValues: QuoteFormValues = {
    clientId: quote.clientId,
    dealDate: quote.dealDate.toISOString().slice(0, 10),
    salesRep: quote.salesRep,
    market: quote.market,
    usState: quote.usState,
    clientName: quote.clientName,
    registeredAddress: quote.registeredAddress,
    website: quote.website,
    assemblyAddress: quote.assemblyAddress,
    clientPo: quote.clientPo,
    actualClient: quote.actualClient,
    socketType: quote.socketType,
    targetDeliveryDate: quote.targetDeliveryDate?.toISOString().slice(0, 10) ?? "",
    vatNumber: quote.vatNumber,
    clientType: quote.clientType,
    currency: parseProductCurrency(quote.currency),
    isVip: quote.client?.isVip ?? false,
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
      productId: li.productId!,
      quantity: li.quantity,
      unitPrice: Number(li.unitPrice),
      finish: li.finish,
      finishDetails: li.finishDetails,
      description: li.description,
      addOns: addOnLines
        .filter((addOn) => addOn.parentLineItemId === li.id)
        .map((addOn) => ({
          productId: addOn.productId!,
          quantity: addOn.quantity,
          unitPrice: Number(addOn.unitPrice),
          description: addOn.description,
        })),
    })),
    standaloneAddOns: addOnLines
      .filter((addOn) => !addOn.parentLineItemId)
      .map((addOn) => ({
        productId: addOn.productId!,
        quantity: addOn.quantity,
        unitPrice: Number(addOn.unitPrice),
        description: addOn.description,
      })),
    customLines: customLines.map((li) => ({
      name: li.customName,
      quantity: li.quantity,
      unitPrice: Number(li.unitPrice),
      description: li.description,
    })),
  };

  const quoteProductIds = [
    ...new Set(
      quote.lineItems.map((li) => li.productId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const extraProducts =
    quoteProductIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: { in: quoteProductIds },
            isActive: false,
          },
          include: productInclude,
        })
      : [];

  const allProducts = [...products, ...extraProducts.filter((p) => !products.some((x) => x.id === p.id))];

  const mapProduct = (p: (typeof allProducts)[number]) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    kind: p.kind,
    listPrice: Number(p.listPrice),
    currency: parseProductCurrency(p.currency),
    boothFamily: p.boothFamily,
    addOnFamily: p.addOnFamily,
    restrictedToBoothFamilies: p.familyRestrictions.map((r) => r.boothFamily),
    availability: p.availability.map((row) => ({
      market: row.market,
      clientType: row.clientType,
    })),
  });

  return (
    <>
      <PageHeader title={`Edit ${quote.quoteNumber}`} description={quote.clientName} />
      <QuoteForm
        quoteId={quote.id}
        products={allProducts.map(mapProduct)}
        clients={mapClientsForQuotePicker(clients)}
        initialValues={initialValues}
      />
    </>
  );
}
