"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export function DealListShell({
  sidebar,
  toolbar,
  activeFilterCount,
  children,
}: {
  sidebar: ReactNode;
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

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close filters"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        id={titleId}
        aria-label="Filters"
        className={`z-50 w-[min(100%,20rem)] shrink-0 bg-white transition-transform duration-200 lg:static lg:z-auto lg:mb-0 lg:w-[280px] lg:translate-x-0 lg:bg-transparent ${
          drawerOpen
            ? "fixed inset-y-0 left-0 translate-x-0 shadow-xl"
            : "fixed inset-y-0 left-0 -translate-x-full lg:relative lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col lg:h-auto">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
            <h2 className="text-base font-semibold text-slate-900">Filters</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 lg:sticky lg:top-4 lg:overflow-visible lg:rounded-xl lg:border lg:border-slate-200 lg:bg-slate-50/80 lg:p-4">
            {sidebar}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
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
        </div>
        {children}
      </div>
    </div>
  );
}
