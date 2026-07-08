import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { mapClientsForQuotePicker } from "@/lib/client-hierarchy";
import { parseProductCurrency } from "@/lib/exchange-rates";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "@/components/quote-form";

export const dynamic = "force-dynamic";

const productInclude = {
  familyRestrictions: { select: { boothFamily: true } },
  availability: { select: { market: true, clientType: true } },
} as const;

export default async function NewQuotePage() {
  const session = await requireSalesAccess();

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
        }))}
        clients={mapClientsForQuotePicker(clients)}
        defaultSalesRep={session.user.name ?? ""}
      />
    </>
  );
}
