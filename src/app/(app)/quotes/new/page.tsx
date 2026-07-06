import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "@/components/quote-form";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const session = await requireSalesAccess();

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

  return (
    <>
      <PageHeader
        title="New quote"
        description="The quote number is assigned automatically when you save."
      />
      <QuoteForm
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
        defaultSalesRep={session.user.name ?? ""}
      />
    </>
  );
}
