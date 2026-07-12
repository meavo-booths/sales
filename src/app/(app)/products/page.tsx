import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { parseProductCurrency } from "@/lib/exchange-rates";
import { EmptyState, PageHeader } from "@/components/ui";
import { ProductListItem, type ProductRow } from "@/components/product-forms";
import { ProductListFilters } from "@/components/product-list-filters";
import { ProductPageActions } from "@/components/product-page-actions";
import {
  buildProductWhereInput,
  hasProductFilters,
  parseClientTypeFilters,
  parseFamilyFilters,
  parseMarketFilters,
} from "@/lib/product-filters";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; market?: string; type?: string; family?: string }>;
}) {
  const session = await requireSalesAccess();

  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const selectedMarkets = parseMarketFilters(params.market);
  const selectedTypes = parseClientTypeFilters(params.type);
  const { boothFamilies, addOnFamilies } = parseFamilyFilters(params.family);

  const filterState = {
    search,
    markets: selectedMarkets,
    clientTypes: selectedTypes,
    boothFamilies,
    addOnFamilies,
  };
  const filtersActive = hasProductFilters(filterState);
  const where = buildProductWhereInput(filterState);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  });
  const isAdmin = user?.systemRole === "ADMIN";

  const products = await prisma.product.findMany({
    where,
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
    taxCode: product.taxCode,
  });

  const booths = products.filter((p) => p.kind === "BOOTH");
  const addOns = products.filter((p) => p.kind === "ADDON");

  return (
    <>
      <PageHeader
        title="Products"
        description="Localized catalog entries for booth families and add-ons."
      >
        <ProductPageActions isAdmin={isAdmin} />
      </PageHeader>

      <div className="mb-6">
        <ProductListFilters
          search={search}
          selectedMarkets={selectedMarkets}
          selectedTypes={selectedTypes}
          selectedBoothFamilies={boothFamilies}
          selectedAddOnFamilies={addOnFamilies}
        />
      </div>

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Booths</h2>
          {booths.length === 0 ? (
            <EmptyState>
              {filtersActive
                ? "No products match these filters."
                : "No booth entries yet. Add your first booth."}
            </EmptyState>
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
              {filtersActive
                ? "No products match these filters."
                : "No add-ons yet. Use “Create add-on” to add extras like warranties, chairs, or monitors."}
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
