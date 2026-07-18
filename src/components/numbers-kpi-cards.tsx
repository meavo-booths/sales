import { Card } from "@/components/ui";
import { formatMoney } from "@/lib/deal-values";
import type { NumbersBucket } from "@/lib/numbers-filters";

function KpiCard({ bucket }: { bucket: NumbersBucket }) {
  return (
    <Card className="!p-4 sm:!p-5">
      <p className="text-sm font-medium text-slate-500">{bucket.label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        {bucket.count}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {formatMoney(bucket.totalEur, "EUR")}
      </p>
    </Card>
  );
}

function KpiSection({
  title,
  description,
  buckets,
}: {
  title: string;
  description: string;
  buckets: NumbersBucket[];
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {buckets.map((bucket) => (
          <KpiCard key={bucket.key} bucket={bucket} />
        ))}
      </div>
    </section>
  );
}

export function NumbersKpiCards({
  openQuotes,
  wonDeals,
}: {
  openQuotes: NumbersBucket[];
  wonDeals: NumbersBucket[];
}) {
  return (
    <>
      <KpiSection
        title="Open quotes"
        description="Count and total value in EUR by quote date."
        buckets={openQuotes}
      />
      <KpiSection
        title="Won deals"
        description="Count and total value in EUR by win date."
        buckets={wonDeals}
      />
    </>
  );
}
