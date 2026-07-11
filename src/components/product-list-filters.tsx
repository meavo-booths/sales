"use client";

import { useEffect, useRef, useState } from "react";
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

type FilterState = {
  search: string;
  markets: string[];
  clientTypes: DealClientType[];
  boothFamilies: BoothProductFamily[];
  addOnFamilies: AddOnProductFamily[];
};

type FilterOption = {
  value: string;
  label: string;
};

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const buttonLabel =
    selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex min-w-[7.5rem] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
          selected.length > 0
            ? "border-brand-500 bg-brand-50 text-brand-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="truncate">{buttonLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
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
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    onChange(
                      checked
                        ? selected.filter((value) => value !== option.value)
                        : [...selected, option.value],
                    );
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const hasFilters =
    selectedMarkets.length > 0 ||
    selectedTypes.length > 0 ||
    selectedBoothFamilies.length > 0 ||
    selectedAddOnFamilies.length > 0;

  const familyOptions: FilterOption[] = [
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

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          Clear
        </button>
      )}
    </form>
  );
}
