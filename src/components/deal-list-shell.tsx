"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function DealListShell({
  renderSidebar,
  toolbar,
  activeFilterCount,
  children,
}: {
  renderSidebar: () => ReactNode;
  toolbar: ReactNode;
  activeFilterCount: number;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const filtersButton = (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:hidden"
    >
      Filters
      {activeFilterCount > 0 ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
          {activeFilterCount}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <aside className="mb-6 hidden w-[280px] shrink-0 lg:mb-0 lg:block">
        <div className="sticky top-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          {renderSidebar()}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {filtersButton}
        </div>
        {children}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 id={titleId} className="text-base font-semibold text-slate-900">
                Filters
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{renderSidebar()}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
