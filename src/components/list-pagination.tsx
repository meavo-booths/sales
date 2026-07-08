import Link from "next/link";

export function ListPagination({
  page,
  totalPages,
  totalCount,
  pageHref,
  countLabel,
  summarySuffix,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageHref: (target: number) => string;
  countLabel: string;
  summarySuffix?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      {page > 1 ? (
        <Link href={pageHref(page - 1)} className="font-medium text-brand-700 hover:underline">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span>
        Page {page} of {totalPages} · {totalCount} {countLabel}
        {totalCount !== 1 ? "s" : ""}
        {summarySuffix ?? ""}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(page + 1)} className="font-medium text-brand-700 hover:underline">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
