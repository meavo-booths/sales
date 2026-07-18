"use client";

import Link from "next/link";
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
import { MultiSelectDropdown } from "@/components/filter-dropdown";

export type DealListPillOption = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

export function countDealSidebarFilters(input: {
  variant: "quotes" | "deals";
  scope: "mine" | "all";
  quotesFilter?: string;
  dealsPaymentPill?: string;
  clientTypes: DealClientType[];
  markets: string[];
  salesReps: string[];
  paymentStatuses: PaymentStatus[];
  socketTypes: string[];
}): number {
  let count = 0;
  if (input.scope !== "mine") count += 1;
  if (input.variant === "quotes" && input.quotesFilter && input.quotesFilter !== "open") {
    count += 1;
  }
  if (input.variant === "deals" && input.dealsPaymentPill && input.dealsPaymentPill !== "all") {
    count += 1;
  }
  if (input.clientTypes.length > 0) count += 1;
  if (input.markets.length > 0) count += 1;
  if (input.salesReps.length > 0) count += 1;
  if (input.variant === "quotes" && input.paymentStatuses.length > 0) count += 1;
  if (input.socketTypes.length > 0) count += 1;
  return count;
}

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-b border-slate-200 py-3 last:border-b-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
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
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function PillList({ options }: { options: DealListPillOption[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            option.active
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export function DealListFiltersSidebar({
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
  ownershipPills,
  statusPills,
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
  ownershipPills: DealListPillOption[];
  statusPills: DealListPillOption[];
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

  const navigate = (patch: Partial<DealListFilterState & DealListUrlState>) => {
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

  const clearAllFilters = () => {
    navigate({
      scope: "mine",
      quotesFilter: variant === "quotes" ? "open" : undefined,
      dealsPaymentPill: variant === "deals" ? "all" : undefined,
      clientTypes: [],
      markets: [],
      salesReps: [],
      paymentStatuses: [],
      socketTypes: [],
    });
  };

  const detailsActive = hasDealAdvancedFilters({
    clientTypes: selectedTypes,
    markets: selectedMarkets,
    salesReps: selectedSalesReps,
    paymentStatuses: selectedPaymentStatuses,
    socketTypes: selectedSocketTypes,
  });

  const activeCount = countDealSidebarFilters({
    variant,
    scope,
    quotesFilter,
    dealsPaymentPill,
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
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              {activeCount}
            </span>
          ) : null}
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <FilterSection title="Ownership">
        <PillList options={ownershipPills} />
      </FilterSection>

      <FilterSection title="Status">
        <PillList options={statusPills} />
      </FilterSection>

      <FilterSection title="Details" defaultOpen={detailsActive}>
        <MultiSelectDropdown
          label="Client type"
          fullWidth
          options={(Object.entries(CLIENT_TYPE_LABELS) as [DealClientType, string][]).map(
            ([value, label]) => ({ value, label }),
          )}
          selected={selectedTypes}
          onChange={(clientTypes) =>
            navigate({ clientTypes: clientTypes as DealClientType[] })
          }
        />

        <MultiSelectDropdown
          label="Market"
          fullWidth
          options={MARKET_OPTIONS.map((market) => ({ value: market, label: market }))}
          selected={selectedMarkets}
          onChange={(markets) => navigate({ markets })}
        />

        {salesRepOptions.length > 0 ? (
          <MultiSelectDropdown
            label="Sales rep"
            fullWidth
            options={salesRepOptions.map((rep) => ({ value: rep, label: rep }))}
            selected={selectedSalesReps}
            onChange={(salesReps) => navigate({ salesReps })}
          />
        ) : null}

        {variant === "quotes" ? (
          <MultiSelectDropdown
            label="Payment status"
            fullWidth
            options={paymentOptions}
            selected={selectedPaymentStatuses}
            onChange={(paymentStatuses) =>
              navigate({ paymentStatuses: paymentStatuses as PaymentStatus[] })
            }
          />
        ) : null}

        {socketTypeOptions.length > 0 ? (
          <MultiSelectDropdown
            label="Socket type"
            fullWidth
            options={socketTypeOptions.map((socket) => ({ value: socket, label: socket }))}
            selected={selectedSocketTypes}
            onChange={(socketTypes) => navigate({ socketTypes })}
          />
        ) : null}
      </FilterSection>
    </div>
  );
}
