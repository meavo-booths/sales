import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { ProductCreateForm, ProductListItem } from "@/components/product-forms";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireSalesAccess();

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Products"
        description="Booth models and services available on quotes."
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {products.length === 0 ? (
            <EmptyState>No products yet. Add your first booth model.</EmptyState>
          ) : (
            products.map((product) => (
              <ProductListItem
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  description: product.description,
                  imageUrl: product.imageUrl,
                  listPrice: product.listPrice.toFixed(2),
                  isActive: product.isActive,
                }}
              />
            ))
          )}
        </div>
        <div>
          <ProductCreateForm />
        </div>
      </div>
    </>
  );
}
