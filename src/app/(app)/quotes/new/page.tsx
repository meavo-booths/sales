import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { PageHeader } from "@/components/ui";
import { QuoteForm } from "@/components/quote-form";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const session = await requireSalesAccess();

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

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
          listPrice: Number(p.listPrice),
        }))}
        defaultSalesRep={session.user.name ?? ""}
      />
    </>
  );
}
