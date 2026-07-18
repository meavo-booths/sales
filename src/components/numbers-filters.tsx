"use client";

import { useRouter } from "next/navigation";
import type { DealClientType } from "@prisma/client";
import { MultiSelectDropdown } from "@/components/filter-dropdown";
import { CLIENT_TYPE_LABELS, MARKET_OPTIONS } from "@/lib/deal-values";
import {
  appendNumbersFilterParams,
  hasNumbersFilters,
  type NumbersFilters,
} from "@/lib/numbers-filters";

export function NumbersFiltersBar({
  filters,
  salesRepOptions,
}: {
  filters: NumbersFilters;
  salesRepOptions: string[];
}) {
  const router = useRouter();

  const navigate = (next: NumbersFilters) => {
    const params = new URLSearchParams();
    appendNumbersFilterParams(params, next);
    const qs = params.toString();
    router.push(qs ? `/numbers?${qs}` : "/numbers");
  };

  const apply = (patch: Partial<NumbersFilters>) => {
    navigate({ ...filters, ...patch });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <MultiSelectDropdown
        label="Client type"
        options={(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(
          ([value, label]) => ({ value, label }),
        )}
        selected={filters.clientTypes}
        onChange={(clientTypes) =>
          apply({ clientTypes: clientTypes as DealClientType[] })
        }
      />

      <MultiSelectDropdown
        label="Market"
        options={MARKET_OPTIONS.map((market) => ({ value: market, label: market }))}
        selected={filters.markets}
        onChange={(markets) => apply({ markets })}
      />

      <MultiSelectDropdown
        label="Sales rep"
        options={salesRepOptions.map((rep) => ({ value: rep, label: rep }))}
        selected={filters.salesReps}
        onChange={(salesReps) => apply({ salesReps })}
      />

      {hasNumbersFilters(filters) ? (
        <button
          type="button"
          onClick={() =>
            navigate({ clientTypes: [], markets: [], salesReps: [] })
          }
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
