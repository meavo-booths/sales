"use client";

import type { ReactNode } from "react";
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
import { Card } from "@/components/ui";

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-800"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function FilterGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

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
  const selectedMarketSet = new Set(selectedMarkets.map((market) => market.toLowerCase()));
  const selectedTypeSet = new Set(selectedTypes);
  const selectedBoothFamilySet = new Set(selectedBoothFamilies);
  const selectedAddOnFamilySet = new Set(selectedAddOnFamilies);

  const navigate = (next: FilterState) => {
    const params = new URLSearchParams();
    appendProductFilterParams(params, next);
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  const toggleMarket = (market: string) => {
    const key = market.toLowerCase();
    const nextMarkets = selectedMarketSet.has(key)
      ? selectedMarkets.filter((value) => value.toLowerCase() !== key)
      : [...selectedMarkets, market];
    navigate({
      search,
      markets: nextMarkets,
      clientTypes: selectedTypes,
      boothFamilies: selectedBoothFamilies,
      addOnFamilies: selectedAddOnFamilies,
    });
  };

  const toggleType = (type: DealClientType) => {
    const nextTypes = selectedTypeSet.has(type)
      ? selectedTypes.filter((value) => value !== type)
      : [...selectedTypes, type];
    navigate({
      search,
      markets: selectedMarkets,
      clientTypes: nextTypes,
      boothFamilies: selectedBoothFamilies,
      addOnFamilies: selectedAddOnFamilies,
    });
  };

  const toggleBoothFamily = (family: BoothProductFamily) => {
    const nextFamilies = selectedBoothFamilySet.has(family)
      ? selectedBoothFamilies.filter((value) => value !== family)
      : [...selectedBoothFamilies, family];
    navigate({
      search,
      markets: selectedMarkets,
      clientTypes: selectedTypes,
      boothFamilies: nextFamilies,
      addOnFamilies: selectedAddOnFamilies,
    });
  };

  const toggleAddOnFamily = (family: AddOnProductFamily) => {
    const nextFamilies = selectedAddOnFamilySet.has(family)
      ? selectedAddOnFamilies.filter((value) => value !== family)
      : [...selectedAddOnFamilies, family];
    navigate({
      search,
      markets: selectedMarkets,
      clientTypes: selectedTypes,
      boothFamilies: selectedBoothFamilies,
      addOnFamilies: nextFamilies,
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

  const hasFilters =
    selectedMarkets.length > 0 ||
    selectedTypes.length > 0 ||
    selectedBoothFamilies.length > 0 ||
    selectedAddOnFamilies.length > 0;

  return (
    <Card className="p-4">
      <form
        className="flex w-full flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          navigate({
            search: String(formData.get("q") ?? ""),
            markets: selectedMarkets,
            clientTypes: selectedTypes,
            boothFamilies: selectedBoothFamilies,
            addOnFamilies: selectedAddOnFamilies,
          });
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search products…"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Search
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </form>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FilterGroup label="Market">
          {MARKET_OPTIONS.map((market) => (
            <FilterChip
              key={market}
              active={selectedMarketSet.has(market.toLowerCase())}
              label={market}
              onClick={() => toggleMarket(market)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Client type">
          {(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(
            ([type, label]) => (
              <FilterChip
                key={type}
                active={selectedTypeSet.has(type)}
                label={label}
                onClick={() => toggleType(type)}
              />
            ),
          )}
        </FilterGroup>

        <FilterGroup label="Model family" className="md:col-span-2 xl:col-span-3">
          {BOOTH_FAMILY_OPTIONS.map((family) => (
            <FilterChip
              key={family}
              active={selectedBoothFamilySet.has(family)}
              label={BOOTH_FAMILY_LABELS[family]}
              onClick={() => toggleBoothFamily(family)}
            />
          ))}
          {ADDON_FAMILY_OPTIONS.map((family) => (
            <FilterChip
              key={family}
              active={selectedAddOnFamilySet.has(family)}
              label={ADDON_FAMILY_LABELS[family]}
              onClick={() => toggleAddOnFamily(family)}
            />
          ))}
        </FilterGroup>
      </div>
    </Card>
  );
}
