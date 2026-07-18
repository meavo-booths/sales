"use client";

import { useRouter } from "next/navigation";
import {
  appendDealListParams,
  type DealListSort,
  type DealListUrlState,
} from "@/lib/deal-list-filters";
import { SingleSelectDropdown } from "@/components/filter-dropdown";

const SORT_OPTIONS: { value: DealListSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
];

export function DealListToolbar({
  basePath,
  variant,
  search,
  sort,
  scope,
  quotesFilter,
  dealsPaymentPill,
  clientTypes,
  markets,
  salesReps,
  paymentStatuses,
  socketTypes,
}: {
  basePath: string;
  variant: "quotes" | "deals";
  search: string;
  sort: DealListSort;
  scope: "mine" | "all";
  quotesFilter?: string;
  dealsPaymentPill?: string;
  clientTypes: DealListUrlState["clientTypes"];
  markets: string[];
  salesReps: string[];
  paymentStatuses: DealListUrlState["paymentStatuses"];
  socketTypes: string[];
}) {
  const router = useRouter();

  const baseUrlState = (): DealListUrlState => ({
    search,
    sort,
    clientTypes,
    markets,
    salesReps,
    paymentStatuses,
    socketTypes,
    scope,
    quotesFilter,
    dealsPaymentPill,
  });

  const navigate = (patch: Partial<DealListUrlState>) => {
    const params = new URLSearchParams();
    appendDealListParams(
      params,
      {
        ...baseUrlState(),
        ...patch,
      },
      variant,
    );
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const clearSearchAndSort = () => {
    navigate({ search: "", sort: "date_desc" });
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        navigate({ search: String(formData.get("q") ?? "") });
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={search}
        placeholder={variant === "quotes" ? "Search quotes…" : "Search deals…"}
        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      <SingleSelectDropdown
        label="Sort"
        options={SORT_OPTIONS}
        value={sort}
        onChange={(value) => navigate({ sort: value as DealListSort })}
      />

      <button
        type="submit"
        className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Search
      </button>

      <button
        type="button"
        onClick={clearSearchAndSort}
        className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
      >
        Clear
      </button>
    </form>
  );
}
