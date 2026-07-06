"use client";

import { useState, useTransition } from "react";
import { checkVatAction, type VatCheckResult } from "@/app/actions/vat";
import { Input } from "@/components/ui";

/**
 * VAT number input with an on-demand VIES/HMRC check button. Drop-in
 * replacement for the plain VAT `Input` in the quote, client, and deal forms.
 * The result is informational only and never blocks saving.
 */
export function VatNumberField({
  value,
  onChange,
  label = "VAT number",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VatCheckResult | null>(null);

  const check = () => {
    setResult(null);
    startTransition(async () => {
      setResult(await checkVatAction(value));
    });
  };

  return (
    <div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => {
              setResult(null);
              onChange(e.target.value);
            }}
            placeholder="e.g. DE123456789"
          />
          <button
            type="button"
            onClick={check}
            disabled={pending || !value.trim()}
            title="Check against the EU VIES database (HMRC for GB numbers)"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Checking…" : "Check"}
          </button>
        </span>
      </label>
      {result && (
        <p
          className={`mt-1 text-xs ${
            result.status === "valid"
              ? "text-green-700"
              : result.status === "invalid"
                ? "text-red-600"
                : "text-amber-700"
          }`}
        >
          {result.status === "valid" ? (
            <>
              ✓ Valid{result.name && ` — ${result.name}`}
              {result.address && ` · ${result.address}`}
            </>
          ) : (
            result.message
          )}
        </p>
      )}
    </div>
  );
}
