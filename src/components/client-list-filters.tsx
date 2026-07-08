"use client";

import { useRouter } from "next/navigation";
import { CLIENT_TYPE_LABELS } from "@/lib/deal-values";
import { appendFilterParams } from "@/lib/client-filters";
import type { ClientHierarchyView } from "@/lib/client-hierarchy";
import type { DealClientType } from "@prisma/client";

const HIERARCHY_LABELS: Record<ClientHierarchyView, string> = {
  top: "Groups & standalone",
  groups: "Groups only",
  subsidiaries: "Subsidiaries",
  all: "All",
};

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
    <div className="space-y-3">
      <form
        className="flex gap-2"
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
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Show
        </span>
        {(Object.entries(HIERARCHY_LABELS) as [ClientHierarchyView, string][]).map(
          ([view, label]) => {
            const active = hierarchyView === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => setHierarchyView(view)}
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
          },
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Client type
        </span>
        {(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(([type, label]) => {
          const active = selectedTypeSet.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
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
        })}
      </div>

      {countries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Country
          </span>
          {countries.map((country) => {
            const active = selectedCountrySet.has(country.toLowerCase());
            return (
              <button
                key={country}
                type="button"
                onClick={() => toggleCountry(country)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {country}
              </button>
            );
          })}
        </div>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
