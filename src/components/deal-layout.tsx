import type { ReactNode } from "react";

/** Internal section within a deal card — divider + heading, no extra card border. */
export function DealSubsection({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Consistent definition-list field grid for deal read views. */
export function DealFieldGrid({
  children,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  children: ReactNode;
  columns?: string;
}) {
  return <dl className={`grid gap-4 ${columns}`}>{children}</dl>;
}

export function DealField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}
