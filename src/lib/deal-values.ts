import type {
  AddOnProductFamily,
  BoothProductFamily,
  BoothUnitStatus,
  DealClientType,
  DealContactKind,
  DealStage,
  PaymentStatus,
  PaymentTerms,
  ProductFinish,
} from "@prisma/client";

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  QUOTE: "Quote",
  WON: "Won",
  LOST: "Lost",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  UPFRONT_100: "100% upfront",
  SPLIT_50_50: "50% / 50%",
  NET_30: "Net 30",
};

export const CLIENT_TYPE_LABELS: Record<DealClientType, string> = {
  DIRECT: "Direct",
  AGENCY: "Agency",
  COWORKING: "Co-working",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
};

export const MARKET_OPTIONS = [
  "UK",
  "US",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Amazon",
  "Balkans",
  "CZ-SK",
  "RoW",
  "Portugal",
] as const;

// Single source of truth lives in exchange-rates.ts (next to the FX logic);
// re-exported here for components that import their option lists from this module.
export { QUOTE_CURRENCIES, type QuoteCurrency } from "@/lib/exchange-rates";

export const BOOTH_FAMILY_LABELS: Record<BoothProductFamily, string> = {
  SOHO: "Soho",
  WORKSTATION: "Workstation",
  CAMDEN_2: "Camden 2",
  CAMDEN_4: "Camden 4",
  HAVEN_ONE: "Haven One",
  HAVEN_FOCUS: "Haven Focus",
  HAVEN_2: "Haven 2",
  HAVEN_4: "Haven 4",
};

export const ADDON_FAMILY_LABELS: Record<AddOnProductFamily, string> = {
  BAR_STOOL: "Bar Stool",
  OFFICE_CHAIR: "Office Chair",
  MONITOR: "Monitor",
  MONITOR_WITH_CAMERA: "Monitor with Camera",
  WARRANTY: "Warranty",
  ASSEMBLY: "Assembly",
  MOVING_SERVICE: "Moving Service",
};

export const BOOTH_FAMILY_OPTIONS = Object.keys(BOOTH_FAMILY_LABELS) as BoothProductFamily[];
export const ADDON_FAMILY_OPTIONS = Object.keys(ADDON_FAMILY_LABELS) as AddOnProductFamily[];

export const SOCKET_TYPE_OPTIONS = [
  "UK",
  "EU",
  "US",
  "CH",
  "AU",
  "DE",
  "FR",
  "IT",
  "ES",
  "NO",
  "CZ",
  "RO",
  "BG",
  "PT",
] as const;

export const CONTACT_KIND_LABELS: Record<DealContactKind, string> = {
  MAIN: "Main contact",
  FINANCE: "Finance contact",
  ASSEMBLY: "Assembly contact",
};

export const FINISH_LABELS: Record<ProductFinish, string> = {
  CUSTOM: "Custom",
  WHITE_STOCK: "White Stock",
  BLACK_STOCK: "Black Stock",
  LDF_COLOUR: "LDF Colour",
};

export const BOOTH_UNIT_STATUS_LABELS: Record<BoothUnitStatus, string> = {
  PLANNED: "Planned",
  IN_PRODUCTION: "In production",
  IN_STORAGE: "In storage",
  IN_TRANSIT: "In transit",
  ASSEMBLED: "Assembled",
  OTHER: "Other",
};

export function formatMoney(amount: number | string, currency = "EUR"): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** dd/mm/yyyy as used in the Ops File sheet. */
export function formatSheetDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getUTCFullYear()}`;
}
