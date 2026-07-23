"use client";

import { useRouter } from "next/navigation";
import { CLIENT_TYPE_LABELS } from "@/lib/deal-values";
import {
  appendFilterParams,
  CLIENT_SORT_OPTIONS,
  type ClientSort,
} from "@/lib/client-filters";
import type { ClientHierarchyView } from "@/lib/client-hierarchy";
import type { DealClientType } from "@prisma/client";
import { MultiSelectDropdown, SingleSelectDropdown } from "@/components/filter-dropdown";

const HIERARCHY_OPTIONS: { value: ClientHierarchyView; label: string }[] = [
  { value: "top", label: "Groups & standalone" },
  { value: "groups", label: "Groups only" },
  { value: "subsidiaries", label: "Subsidiaries" },
  { value: "all", label: "All" },
];

type FilterState = {
  search: string;
  types: DealClientType[];
  countries: string[];
  hierarchyView: ClientHierarchyView;
  sort: ClientSort;
};

export function ClientListFilters({
  search,
  selectedTypes,
  selectedCountries,
  countries,
  hierarchyView,
  sort,
}: {
  search: string;
  selectedTypes: DealClientType[];
  selectedCountries: string[];
  countries: string[];
  hierarchyView: ClientHierarchyView;
  sort: ClientSort;
}) {
  const router = useRouter();

  const navigate = (next: FilterState) => {
    const params = new URLSearchParams();
    if (next.search.trim()) params.set("q", next.search.trim());
    appendFilterParams(params, "type", next.types);
    appendFilterParams(params, "country", next.countries);
    if (next.hierarchyView !== "top") params.set("view", next.hierarchyView);
    if (next.sort !== "name") params.set("sort", next.sort);
    const qs = params.toString();
    router.push(qs ? `/clients?${qs}` : "/clients");
  };

  const applyFilters = (patch: Partial<FilterState>) => {
    navigate({
      search,
      types: selectedTypes,
      countries: selectedCountries,
      hierarchyView,
      sort,
      ...patch,
    });
  };

  const clearFilters = () => {
    navigate({
      search,
      types: [],
      countries: [],
      hierarchyView: "top",
      sort,
    });
  };

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
        placeholder="Search clients…"
        className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />

      <SingleSelectDropdown
        label="Show"
        options={HIERARCHY_OPTIONS}
        value={hierarchyView}
        onChange={(view) => applyFilters({ hierarchyView: view as ClientHierarchyView })}
      />

      <MultiSelectDropdown
        label="Client type"
        options={(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(
          ([value, label]) => ({ value, label }),
        )}
        selected={selectedTypes}
        onChange={(types) => applyFilters({ types: types as DealClientType[] })}
      />

      {countries.length > 0 && (
        <MultiSelectDropdown
          label="Country"
          options={countries.map((country) => ({ value: country, label: country }))}
          selected={selectedCountries}
          onChange={(nextCountries) => applyFilters({ countries: nextCountries })}
        />
      )}

      <SingleSelectDropdown
        label="Sort"
        options={[...CLIENT_SORT_OPTIONS]}
        value={sort}
        onChange={(value) => applyFilters({ sort: value as ClientSort })}
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
