import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  ProductCreateForm,
  ProductListItem,
  type ProductRow,
} from "@/components/product-forms";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireSalesAccess();

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const toRow = (product: (typeof products)[number]): ProductRow => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    kind: product.kind,
    description: product.description,
    imageUrl: product.imageUrl,
    listPrice: product.listPrice.toFixed(2),
    isActive: product.isActive,
  });

  const booths = products.filter((p) => p.kind === "BOOTH");
  const addOns = products.filter((p) => p.kind === "ADDON");

  return (
    <>
      <PageHeader
        title="Products"
        description="Booth models, plus add-ons that can be sold standalone or attached to booths."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Booths</h2>
            {booths.length === 0 ? (
              <EmptyState>No booth models yet. Add your first booth model.</EmptyState>
            ) : (
              booths.map((product) => (
                <ProductListItem key={product.id} product={toRow(product)} />
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Add-ons</h2>
            {addOns.length === 0 ? (
              <EmptyState>
                No add-ons yet. Add extras like warranties, chairs, or monitors with the
                “Add-on” type.
              </EmptyState>
            ) : (
              addOns.map((product) => (
                <ProductListItem key={product.id} product={toRow(product)} />
              ))
            )}
          </section>
        </div>
        <div>
          <ProductCreateForm />
        </div>
      </div>
    </>
  );
}
