import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { parseProductCurrency } from "@/lib/exchange-rates";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import {
  AddOnCreateForm,
  BoothCreateForm,
  ProductListItem,
  SyncXeroProductsButton,
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
    include: {
      familyRestrictions: { select: { boothFamily: true } },
      availability: { select: { market: true, clientType: true } },
    },
  });

  const toRow = (product: (typeof products)[number]): ProductRow => ({
    id: product.id,
    name: product.name,
    version: product.version,
    kind: product.kind,
    boothFamily: product.boothFamily,
    addOnFamily: product.addOnFamily,
    description: product.description,
    imageUrl: product.imageUrl,
    listPrice: product.listPrice.toFixed(2),
    currency: parseProductCurrency(product.currency),
    isActive: product.isActive,
    restrictedBoothFamilies: product.familyRestrictions.map((r) => r.boothFamily),
    availability: product.availability.map((row) => ({
      market: row.market,
      clientType: row.clientType,
    })),
    xeroItemCode: product.xeroItemCode,
  });

  const booths = products.filter((p) => p.kind === "BOOTH");
  const addOns = products.filter((p) => p.kind === "ADDON");

  return (
    <>
      <PageHeader
        title="Products"
        description="Localized catalog entries for booth families and add-ons."
      >
        <SyncXeroProductsButton />
      </PageHeader>

      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateCard
            title="Create booth"
            description="Add a localized booth entry with family, version, list price, and image."
          >
            <BoothCreateForm />
          </CreateCard>

          <CreateCard
            title="Create add-on"
            description="Add extras and pick which booth families they are compatible with."
          >
            <AddOnCreateForm />
          </CreateCard>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Booths</h2>
          {booths.length === 0 ? (
            <EmptyState>No booth entries yet. Add your first booth.</EmptyState>
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
              No add-ons yet. Use “Create add-on” above to add extras like warranties,
              chairs, or monitors.
            </EmptyState>
          ) : (
            addOns.map((product) => (
              <ProductListItem key={product.id} product={toRow(product)} />
            ))
          )}
        </section>
      </div>
    </>
  );
}
