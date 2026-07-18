import { requireSalesAccess } from "@/lib/meavo-auth";
import { PageHeader } from "@/components/ui";
import { NumbersFiltersBar } from "@/components/numbers-filters";
import { NumbersKpiCards } from "@/components/numbers-kpi-cards";
import { NumbersCharts } from "@/components/numbers-charts";
import { parseNumbersFilters } from "@/lib/numbers-filters";
import {
  loadNumbersDashboard,
  loadSalesRepOptions,
} from "@/lib/numbers-dashboard";

export const dynamic = "force-dynamic";

type SearchParams = {
  type?: string | string[];
  market?: string | string[];
  salesRep?: string | string[];
};

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSalesAccess();
  const params = await searchParams;
  const filters = parseNumbersFilters(params);

  const [dashboard, salesRepOptions] = await Promise.all([
    loadNumbersDashboard(filters),
    loadSalesRepOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Numbers"
        description="Reporting dashboard for quotes, deals, and revenue."
      />
      <NumbersFiltersBar filters={filters} salesRepOptions={salesRepOptions} />
      <NumbersKpiCards
        openQuotes={dashboard.openQuotes}
        wonDeals={dashboard.wonDeals}
      />
      <NumbersCharts year={dashboard.year} monthly={dashboard.monthly} />
    </>
  );
}
