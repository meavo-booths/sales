"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_TYPE_LABELS } from "@/lib/deal-values";
import { appendFilterParams } from "@/lib/client-filters";
import type { ClientHierarchyView } from "@/lib/client-hierarchy";
import type { DealClientType } from "@prisma/client";
import { Card } from "@/components/ui";

const HIERARCHY_LABELS: Record<ClientHierarchyView, string> = {
  top: "Groups & standalone",
  groups: "Groups only",
  subsidiaries: "Subsidiaries",
  all: "All",
};

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

export function ClientListFilters({
  search,
  selectedTypes,
  selectedCountries,
  countries,
  hierarchyView,
}: {
  search: string;
  selectedTypes: DealClientType[];
  selectedCountries: string[];
  countries: string[];
  hierarchyView: ClientHierarchyView;
}) {
  const router = useRouter();
  const selectedTypeSet = new Set(selectedTypes);
  const selectedCountrySet = new Set(selectedCountries.map((country) => country.toLowerCase()));

  const navigate = (next: {
    search: string;
    types: DealClientType[];
    countries: string[];
    hierarchyView: ClientHierarchyView;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set("q", next.search.trim());
    appendFilterParams(params, "type", next.types);
    appendFilterParams(params, "country", next.countries);
    if (next.hierarchyView !== "top") params.set("view", next.hierarchyView);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.push(qs ? `/clients?${qs}` : "/clients");
  };

  const toggleType = (type: DealClientType) => {
    const nextTypes = selectedTypeSet.has(type)
      ? selectedTypes.filter((value) => value !== type)
      : [...selectedTypes, type];
    navigate({ search, types: nextTypes, countries: selectedCountries, hierarchyView });
  };

  const toggleCountry = (country: string) => {
    const key = country.toLowerCase();
    const nextCountries = selectedCountrySet.has(key)
      ? selectedCountries.filter((value) => value.toLowerCase() !== key)
      : [...selectedCountries, country];
    navigate({ search, types: selectedTypes, countries: nextCountries, hierarchyView });
  };

  const setHierarchyView = (view: ClientHierarchyView) => {
    navigate({ search, types: selectedTypes, countries: selectedCountries, hierarchyView: view });
  };

  const clearFilters = () => {
    navigate({ search, types: [], countries: [], hierarchyView: "top" });
  };

  const hasFilters =
    selectedTypes.length > 0 || selectedCountries.length > 0 || hierarchyView !== "top";

  return (
    <Card className="p-4">
      <form
        className="flex w-full flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          navigate({
            search: String(formData.get("q") ?? ""),
            types: selectedTypes,
            countries: selectedCountries,
            hierarchyView,
          });
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search clients…"
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
        <FilterGroup label="Show">
          {(Object.entries(HIERARCHY_LABELS) as [ClientHierarchyView, string][]).map(
            ([view, label]) => (
              <FilterChip
                key={view}
                active={hierarchyView === view}
                label={label}
                onClick={() => setHierarchyView(view)}
              />
            ),
          )}
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

        {countries.length > 0 && (
          <FilterGroup
            label="Country"
            className={countries.length > 8 ? "md:col-span-2 xl:col-span-3" : ""}
          >
            {countries.map((country) => (
              <FilterChip
                key={country}
                active={selectedCountrySet.has(country.toLowerCase())}
                label={country}
                onClick={() => toggleCountry(country)}
              />
            ))}
          </FilterGroup>
        )}
      </div>
    </Card>
  );
}
