import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  AddOnCreateForm,
  BoothCreateForm,
  ProductListItem,
  type BoothOption,
  type ProductRow,
} from "@/components/product-forms";

export const dynamic = "force-dynamic";

function CreateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <svg
            className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </summary>
        {children}
      </details>
    </Card>
  );
}

export default async function ProductsPage() {
  await requireSalesAccess();

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { addOnRestrictions: { select: { boothId: true } } },
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
    restrictedBoothIds: product.addOnRestrictions.map((r) => r.boothId),
  });

  const booths = products.filter((p) => p.kind === "BOOTH");
  const addOns = products.filter((p) => p.kind === "ADDON");

  const boothOptions: BoothOption[] = booths.map((b) => ({
    id: b.id,
    name: b.name,
    sku: b.sku,
  }));

  return (
    <>
      <PageHeader
        title="Products"
        description="Booth models, plus add-ons that can be sold standalone or attached to booths."
      />

      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateCard
            title="Create booth"
            description="Add a booth model with its SKU, list price, and image."
          >
            <BoothCreateForm />
          </CreateCard>

          <CreateCard
            title="Create add-on"
            description="Add extras like warranties, chairs, or monitors, and pick which booths they fit."
          >
            <AddOnCreateForm booths={boothOptions} />
          </CreateCard>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Booths</h2>
          {booths.length === 0 ? (
            <EmptyState>No booth models yet. Add your first booth model.</EmptyState>
          ) : (
            booths.map((product) => (
              <ProductListItem
                key={product.id}
                product={toRow(product)}
                booths={boothOptions}
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Add-ons</h2>
          {addOns.length === 0 ? (
            <EmptyState>
              No add-ons yet. Use “Create add-on” above to add extras like warranties,
              chairs, or monitors.
            </EmptyState>
          ) : (
            addOns.map((product) => (
              <ProductListItem
                key={product.id}
                product={toRow(product)}
                booths={boothOptions}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}
