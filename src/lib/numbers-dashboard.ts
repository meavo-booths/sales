import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  NumbersBucket,
  NumbersFilters,
  NumbersMonthPoint,
} from "@/lib/numbers-filters";

export type {
  NumbersBucket,
  NumbersFilters,
  NumbersMonthPoint,
} from "@/lib/numbers-filters";
export {
  appendNumbersFilterParams,
  hasNumbersFilters,
  parseNumbersFilters,
} from "@/lib/numbers-filters";

export type NumbersDashboard = {
  year: number;
  openQuotes: NumbersBucket[];
  wonDeals: NumbersBucket[];
  monthly: NumbersMonthPoint[];
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** UTC calendar date at 00:00 (date-only semantics for dealDate). */
export function utcDateOnly(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  const next = utcDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Whole UTC calendar days from `from` to `to` (can be negative). */
export function utcCalendarDaysBetween(from: Date, to: Date): number {
  const a = utcDateOnly(from).getTime();
  const b = utcDateOnly(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function numbersDealWhere(filters: NumbersFilters): Prisma.DealWhereInput {
  const and: Prisma.DealWhereInput[] = [];
  if (filters.clientTypes.length > 0) {
    and.push({ clientType: { in: filters.clientTypes } });
  }
  if (filters.markets.length > 0) {
    and.push({ market: { in: filters.markets } });
  }
  if (filters.salesReps.length > 0) {
    and.push({ salesRep: { in: filters.salesReps } });
  }
  return and.length > 0 ? { AND: and } : {};
}

async function sumDealTotalEur(dealIds: string[]): Promise<number> {
  if (dealIds.length === 0) return 0;
  const rows = await prisma.$queryRaw<{ revenue: number }[]>`
    SELECT COALESCE(SUM(li.quantity * COALESCE(
      li."unitPriceEur",
      CASE WHEN d.currency = 'EUR' THEN li."unitPrice" END
    )), 0)::float AS revenue
    FROM "QuoteLineItem" li
    JOIN "Deal" d ON d.id = li."dealId"
    WHERE d.id = ANY(${dealIds})
  `;
  return rows[0]?.revenue ?? 0;
}

async function bucketFromWhere(
  where: Prisma.DealWhereInput,
  key: string,
  label: string,
): Promise<NumbersBucket> {
  const deals = await prisma.deal.findMany({
    where,
    select: { id: true },
  });
  const ids = deals.map((d) => d.id);
  return {
    key,
    label,
    count: ids.length,
    totalEur: await sumDealTotalEur(ids),
  };
}

function emptyMonthly(year: number): NumbersMonthPoint[] {
  return MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    conversionPct: null,
    avgDaysToWin: null,
    quoteCount: 0,
    wonCount: 0,
    winsInMonth: 0,
  }));
}

export async function loadSalesRepOptions(): Promise<string[]> {
  const rows = await prisma.deal.findMany({
    where: { salesRep: { not: "" } },
    distinct: ["salesRep"],
    select: { salesRep: true },
    orderBy: { salesRep: "asc" },
  });
  return rows.map((row) => row.salesRep).filter(Boolean);
}

export async function loadNumbersDashboard(
  filters: NumbersFilters,
  now: Date = new Date(),
): Promise<NumbersDashboard> {
  const today = utcDateOnly(now);
  const yesterday = addUtcDays(today, -1);
  const last7Start = addUtcDays(today, -6);
  const olderThan30Cutoff = addUtcDays(today, -30);
  const tomorrow = addUtcDays(today, 1);
  const wonLast7Start = addUtcDays(today, -6);
  const wonLast30Start = addUtcDays(today, -29);

  const year = today.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const filterWhere = numbersDealWhere(filters);
  const scoped = (extra: Prisma.DealWhereInput): Prisma.DealWhereInput => {
    if (Object.keys(filterWhere).length === 0) return extra;
    return { AND: [filterWhere, extra] };
  };

  const [
    quotesYesterday,
    quotesLast7,
    quotesOlder30,
    wonYesterday,
    wonLast7,
    wonLast30,
    cohortDeals,
    wonTimingDeals,
  ] = await Promise.all([
    bucketFromWhere(
      scoped({ stage: "QUOTE", dealDate: yesterday }),
      "yesterday",
      "Yesterday",
    ),
    bucketFromWhere(
      scoped({
        stage: "QUOTE",
        dealDate: { gte: last7Start, lte: today },
      }),
      "last7",
      "Last 7 days",
    ),
    bucketFromWhere(
      scoped({
        stage: "QUOTE",
        dealDate: { lt: olderThan30Cutoff },
      }),
      "older30",
      "Older than 30 days",
    ),
    bucketFromWhere(
      scoped({
        stage: "WON",
        wonAt: { gte: yesterday, lt: today },
      }),
      "yesterday",
      "Yesterday",
    ),
    bucketFromWhere(
      scoped({
        stage: "WON",
        wonAt: { gte: wonLast7Start, lt: tomorrow },
      }),
      "last7",
      "Last 7 days",
    ),
    bucketFromWhere(
      scoped({
        stage: "WON",
        wonAt: { gte: wonLast30Start, lt: tomorrow },
      }),
      "last30",
      "Last 30 days",
    ),
    prisma.deal.findMany({
      where: scoped({
        dealDate: { gte: yearStart, lt: yearEnd },
      }),
      select: { dealDate: true, stage: true },
    }),
    prisma.deal.findMany({
      where: scoped({
        stage: "WON",
        wonAt: { gte: yearStart, lt: yearEnd },
      }),
      select: { dealDate: true, wonAt: true },
    }),
  ]);

  const monthly = emptyMonthly(year);

  for (const deal of cohortDeals) {
    if (!deal.dealDate) continue;
    const month = deal.dealDate.getUTCMonth();
    const point = monthly[month];
    if (!point) continue;
    point.quoteCount += 1;
    if (deal.stage === "WON") point.wonCount += 1;
  }

  const daysByMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (const deal of wonTimingDeals) {
    if (!deal.wonAt || !deal.dealDate) continue;
    const month = deal.wonAt.getUTCMonth();
    const days = utcCalendarDaysBetween(deal.dealDate, deal.wonAt);
    daysByMonth[month]?.push(days);
    const point = monthly[month];
    if (point) point.winsInMonth += 1;
  }

  for (let i = 0; i < 12; i++) {
    const point = monthly[i]!;
    point.conversionPct =
      point.quoteCount > 0
        ? Math.round((point.wonCount / point.quoteCount) * 1000) / 10
        : null;
    const days = daysByMonth[i]!;
    if (days.length > 0) {
      const avg = days.reduce((sum, d) => sum + d, 0) / days.length;
      point.avgDaysToWin = Math.round(avg * 10) / 10;
    }
  }

  return {
    year,
    openQuotes: [quotesYesterday, quotesLast7, quotesOlder30],
    wonDeals: [wonYesterday, wonLast7, wonLast30],
    monthly,
  };
}
