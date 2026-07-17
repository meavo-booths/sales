"use client";

import type { PaymentTerms } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  checkDealIdAction,
  convertQuoteAction,
  type DealIdCheck,
} from "@/app/actions/deals";
import { Modal } from "@/components/modal";
import { Button, Input } from "@/components/ui";

type ConvertQuoteButtonProps = {
  quoteId: string;
  paymentTerms: PaymentTerms;
};

export function ConvertQuoteButton({ quoteId, paymentTerms }: ConvertQuoteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [skipXeroInvoice, setSkipXeroInvoice] = useState(false);
  const [dealId, setDealId] = useState("");
  const [poDate, setPoDate] = useState("");
  const [check, setCheck] = useState<DealIdCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const manualDealId = useMemo(
    () => skipXeroInvoice || paymentTerms === "NET_7" || paymentTerms === "NET_30",
    [skipXeroInvoice, paymentTerms],
  );

  useEffect(() => {
    if (!manualDealId) {
      setCheck(null);
      return;
    }
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
  }, [dealId, manualDealId]);

  const canSubmit = manualDealId
    ? Boolean(dealId.trim()) && (check === null || check.available)
    : true;

  const convert = () => {
    setError(null);
    startTransition(async () => {
      const result = await convertQuoteAction(quoteId, {
        skipXeroInvoice,
        dealId: manualDealId ? dealId.trim() : undefined,
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
        onClick={() => {
          setPoDate(new Date().toISOString().slice(0, 10));
          setOpen(true);
        }}
      >
        FUCK YEAH
      </Button>

      <Modal title="Deal won 🎉" open={open} onClose={() => setOpen(false)} bodyClassName="">
        <p className="mt-1 text-sm text-slate-600">
          Convert this quote into a won deal. Booth units will be created for manufacturing and
          the deal will be added to the Ops File.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pending || !canSubmit) return;
            convert();
          }}
        >
          <div className="mt-4 space-y-3">
            {paymentTerms !== "NET_7" && paymentTerms !== "NET_30" && (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={skipXeroInvoice}
                  onChange={(e) => setSkipXeroInvoice(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">No Xero invoice</span>
                  <span className="mt-0.5 block text-slate-600">
                    Skip creating a draft invoice at win time and enter the DealID manually.
                  </span>
                </span>
              </label>
            )}

            {manualDealId ? (
              <>
                <Input
                  label="DealID"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  placeholder="e.g. INV-2026-104"
                  autoFocus
                />
                {paymentTerms === "NET_7" || paymentTerms === "NET_30" ? (
                  <p className="text-sm text-slate-600">
                    Net 7 deals use a manual DealID. Create the Xero invoice from the deal page
                    when ready.
                  </p>
                ) : null}
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
              </>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                DealID will be assigned from the Xero invoice number when the draft invoice is
                created.
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={pending || !canSubmit}
            >
              {pending ? "Converting…" : "Convert to won deal"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
