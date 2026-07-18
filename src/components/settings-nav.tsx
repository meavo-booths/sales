"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ALL_TABS = [
  { href: "/products", label: "Products", adminOnly: false },
  { href: "/settings/xero", label: "Xero", adminOnly: true },
  { href: "/settings/xero/us", label: "Xero US", adminOnly: true },
] as const;

export function SettingsNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const tabs = ALL_TABS.filter((tab) => !tab.adminOnly || admin);

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
      aria-label="Settings sections"
    >
      {tabs.map((tab) => {
        // Exact match for /settings/xero so Xero US does not light up the Xero tab.
        const active =
          tab.href === "/settings/xero"
            ? pathname === "/settings/xero"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
