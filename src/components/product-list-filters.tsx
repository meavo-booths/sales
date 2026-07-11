"use client";

import { useRouter } from "next/navigation";
import type { AddOnProductFamily, BoothProductFamily, DealClientType } from "@prisma/client";
import {
  ADDON_FAMILY_LABELS,
  ADDON_FAMILY_OPTIONS,
  BOOTH_FAMILY_LABELS,
  BOOTH_FAMILY_OPTIONS,
  CLIENT_TYPE_LABELS,
  MARKET_OPTIONS,
} from "@/lib/deal-values";
import { appendProductFilterParams } from "@/lib/product-filters";
import { MultiSelectDropdown } from "@/components/filter-dropdown";

type FilterState = {
  search: string;
  markets: string[];
  clientTypes: DealClientType[];
  boothFamilies: BoothProductFamily[];
  addOnFamilies: AddOnProductFamily[];
};

export function ProductListFilters({
  search,
  selectedMarkets,
  selectedTypes,
  selectedBoothFamilies,
  selectedAddOnFamilies,
}: {
  search: string;
  selectedMarkets: string[];
  selectedTypes: DealClientType[];
  selectedBoothFamilies: BoothProductFamily[];
  selectedAddOnFamilies: AddOnProductFamily[];
}) {
  const router = useRouter();

  const navigate = (next: FilterState) => {
    const params = new URLSearchParams();
    appendProductFilterParams(params, next);
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  const applyFilters = (patch: Partial<FilterState>) => {
    navigate({
      search,
      markets: selectedMarkets,
      clientTypes: selectedTypes,
      boothFamilies: selectedBoothFamilies,
      addOnFamilies: selectedAddOnFamilies,
      ...patch,
    });
  };

  const clearFilters = () => {
    navigate({
      search,
      markets: [],
      clientTypes: [],
      boothFamilies: [],
      addOnFamilies: [],
    });
  };

  const familyOptions = [
    ...BOOTH_FAMILY_OPTIONS.map((family) => ({
      value: family,
      label: BOOTH_FAMILY_LABELS[family],
    })),
    ...ADDON_FAMILY_OPTIONS.map((family) => ({
      value: family,
      label: ADDON_FAMILY_LABELS[family],
    })),
  ];
  const selectedFamilies = [...selectedBoothFamilies, ...selectedAddOnFamilies];

  return (
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
        placeholder="Search products…"
        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      <MultiSelectDropdown
        label="Market"
        options={MARKET_OPTIONS.map((market) => ({ value: market, label: market }))}
        selected={selectedMarkets}
        onChange={(markets) => applyFilters({ markets })}
      />

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
        label="Family"
        options={familyOptions}
        selected={selectedFamilies}
        onChange={(families) => {
          const boothSet = new Set(BOOTH_FAMILY_OPTIONS);
          const addOnSet = new Set(ADDON_FAMILY_OPTIONS);
          applyFilters({
            boothFamilies: families.filter((value): value is BoothProductFamily =>
              boothSet.has(value as BoothProductFamily),
            ),
            addOnFamilies: families.filter((value): value is AddOnProductFamily =>
              addOnSet.has(value as AddOnProductFamily),
            ),
          });
        }}
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
  );
}
