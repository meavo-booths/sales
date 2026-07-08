import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { mapClientsForQuotePicker } from "@/lib/client-hierarchy";
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
      include: {
        parent: { select: { name: true, isVip: true } },
        contacts: { orderBy: { sortOrder: "asc" } },
        _count: { select: { subsidiaries: true } },
      },
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
        clients={mapClientsForQuotePicker(clients)}
        defaultSalesRep={session.user.name ?? ""}
      />
    </>
  );
}
