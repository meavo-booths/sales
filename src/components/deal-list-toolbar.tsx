"use client";

import { useRouter } from "next/navigation";
import type { DealClientType, PaymentStatus } from "@prisma/client";
import {
  CLIENT_TYPE_LABELS,
  MARKET_OPTIONS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/deal-values";
import {
  appendDealListParams,
  hasDealAdvancedFilters,
  type DealListFilterState,
  type DealListSort,
  type DealListUrlState,
} from "@/lib/deal-list-filters";
import { MultiSelectDropdown, SingleSelectDropdown } from "@/components/filter-dropdown";

const SORT_OPTIONS: { value: DealListSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
];

type ToolbarState = DealListFilterState;

export function DealListToolbar({
  basePath,
  variant,
  search,
  sort,
  selectedTypes,
  selectedMarkets,
  selectedSalesReps,
  selectedPaymentStatuses,
  selectedSocketTypes,
  salesRepOptions,
  socketTypeOptions,
  scope,
  quotesFilter,
  dealsPaymentPill,
}: {
  basePath: string;
  variant: "quotes" | "deals";
  search: string;
  sort: DealListSort;
  selectedTypes: DealClientType[];
  selectedMarkets: string[];
  selectedSalesReps: string[];
  selectedPaymentStatuses: PaymentStatus[];
  selectedSocketTypes: string[];
  salesRepOptions: string[];
  socketTypeOptions: string[];
  scope: "mine" | "all";
  quotesFilter?: string;
  dealsPaymentPill?: string;
}) {
  const router = useRouter();

  const baseUrlState = (): DealListUrlState => ({
    search,
    sort,
    clientTypes: selectedTypes,
    markets: selectedMarkets,
    salesReps: selectedSalesReps,
    paymentStatuses: selectedPaymentStatuses,
    socketTypes: selectedSocketTypes,
    scope,
    quotesFilter,
    dealsPaymentPill,
  });

  const navigate = (patch: Partial<ToolbarState>) => {
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

  const applyFilters = (patch: Partial<ToolbarState>) => {
    navigate(patch);
  };

  const clearFilters = () => {
    navigate({
      search: "",
      sort: "date_desc",
      clientTypes: [],
      markets: [],
      salesReps: [],
      paymentStatuses: [],
      socketTypes: [],
    });
  };

  const advancedActive = hasDealAdvancedFilters({
    clientTypes: selectedTypes,
    markets: selectedMarkets,
    salesReps: selectedSalesReps,
    paymentStatuses: selectedPaymentStatuses,
    socketTypes: selectedSocketTypes,
  });

  const paymentOptions = (
    Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][]
  ).map(([value, label]) => ({ value, label }));

  return (
    <div className="mb-6 space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          applyFilters({ search: String(formData.get("q") ?? "") });
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
          onChange={(value) => applyFilters({ sort: value as DealListSort })}
        />

        <button
          type="submit"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Search
        </button>

        <button
          type="button"
          onClick={clearFilters}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          Clear
        </button>
      </form>

      <details className="group rounded-lg border border-slate-200 bg-white" open={advancedActive}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
          <span>
            More filters
            {advancedActive && (
              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
                Active
              </span>
            )}
          </span>
          <svg
            className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
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

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <MultiSelectDropdown
            label="Client type"
            options={(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(
              ([value, label]) => ({ value, label }),
            )}
            selected={selectedTypes}
            onChange={(clientTypes) =>
              applyFilters({ clientTypes: clientTypes as DealClientType[] })
            }
          />

          <MultiSelectDropdown
            label="Market"
            options={MARKET_OPTIONS.map((market) => ({ value: market, label: market }))}
            selected={selectedMarkets}
            onChange={(markets) => applyFilters({ markets })}
          />

          {salesRepOptions.length > 0 && (
            <MultiSelectDropdown
              label="Sales rep"
              options={salesRepOptions.map((rep) => ({ value: rep, label: rep }))}
              selected={selectedSalesReps}
              onChange={(salesReps) => applyFilters({ salesReps })}
            />
          )}

          {variant === "quotes" && (
            <MultiSelectDropdown
              label="Payment status"
              options={paymentOptions}
              selected={selectedPaymentStatuses}
              onChange={(paymentStatuses) =>
                applyFilters({ paymentStatuses: paymentStatuses as PaymentStatus[] })
              }
            />
          )}

          {socketTypeOptions.length > 0 && (
            <MultiSelectDropdown
              label="Socket type"
              options={socketTypeOptions.map((socket) => ({ value: socket, label: socket }))}
              selected={selectedSocketTypes}
              onChange={(socketTypes) => applyFilters({ socketTypes })}
            />
          )}
        </div>
      </details>
    </div>
  );
}
