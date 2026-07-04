"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  checkDealIdAction,
  convertQuoteAction,
  type DealIdCheck,
} from "@/app/actions/deals";
import { Button, Input } from "@/components/ui";

export function ConvertQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dealId, setDealId] = useState("");
  const [poDate, setPoDate] = useState("");
  const [check, setCheck] = useState<DealIdCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live availability check while the rep types the DealID.
  useEffect(() => {
    const value = dealId.trim();
    setCheck(null);
    if (!value) return;
    const timer = setTimeout(async () => {
      try {
        setCheck(await checkDealIdAction(value));
      } catch {
        setCheck(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [dealId]);

  const convert = () => {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteAction(quoteId, {
        dealId: dealId.trim(),
        paymentPoDate: poDate || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/deals/${result.id}`);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        className="bg-green-600 px-6 text-base font-bold tracking-wide hover:bg-green-700"
        onClick={() => setOpen(true)}
      >
        FUCK YEAH
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Deal won 🎉</h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter the DealID (invoice/PO number) to convert this quote into a won deal. Booth
              units will be created for manufacturing and the deal will be added to the Ops File.
            </p>

            <div className="mt-4 space-y-3">
              <Input
                label="DealID"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="e.g. INV-2026-104"
                autoFocus
              />
              {check && !check.available && (
                <p className="text-sm text-red-600">
                  {check.conflictQuoteNumber
                    ? `Already used by quote ${check.conflictQuoteNumber}.`
                    : "This DealID is already in use."}
                </p>
              )}
              {check?.available && (
                <p className="text-sm text-green-700">
                  DealID is available.
                  {check.assemblyExists &&
                    " Note: an Assembly record with this DealID already exists — they will be linked."}
                </p>
              )}
              <Input
                label="Payment / PO date (optional)"
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={convert}
                disabled={pending || !dealId.trim() || (check !== null && !check.available)}
              >
                {pending ? "Converting…" : "Convert to won deal"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
