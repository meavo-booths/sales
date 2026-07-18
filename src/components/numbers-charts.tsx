"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui";
import type { NumbersMonthPoint } from "@/lib/numbers-filters";

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}

export function NumbersCharts({
  year,
  monthly,
}: {
  year: number;
  monthly: NumbersMonthPoint[];
}) {
  const conversionData = monthly.map((point) => ({
    label: point.label,
    rate: point.conversionPct,
    quotes: point.quoteCount,
    won: point.wonCount,
  }));

  const timeData = monthly.map((point) => ({
    label: point.label,
    days: point.avgDaysToWin,
    wins: point.winsInMonth,
  }));

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{year}</h2>
        <p className="text-sm text-slate-500">
          Monthly conversion and average time to win for the current year.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Conversion rate"
          description="Won deals ÷ all quotes by quote date (includes open and lost)."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={conversionData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                width={40}
              />
              <Tooltip
                formatter={(value) =>
                  value == null ? ["—", "Conversion"] : [`${value}%`, "Conversion"]
                }
                labelFormatter={(label) => `${label} ${year}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="rate"
                name="Conversion"
                stroke="#0f766e"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Average time to win"
          description="Mean days from quote date to won date, for deals won each month."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickFormatter={(value: number) => `${value}d`}
                width={40}
              />
              <Tooltip
                formatter={(value) =>
                  value == null ? ["—", "Avg days"] : [`${value} days`, "Avg days"]
                }
                labelFormatter={(label) => `${label} ${year}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="days"
                name="Avg days"
                stroke="#1d4ed8"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}
