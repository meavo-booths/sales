"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteQuoteAction } from "@/app/actions/quotes";
import { markQuoteLostAction } from "@/app/actions/deals";
import { Modal } from "@/components/modal";
import { Button, Textarea } from "@/components/ui";
import {
  LOST_REASON_LABELS,
  LOST_REASON_OPTIONS,
  type LostReasonOption,
} from "@/lib/deal-values";

export function QuoteSecondaryActions({
  quoteId,
  isAdmin = false,
}: {
  quoteId: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState<LostReasonOption | "">("");
  const [note, setNote] = useState("");

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, redirectTo?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  };

  const canMarkLost =
    Boolean(reason) && (reason !== "OTHER" || note.trim().length > 0);

  const markLost = () => {
    if (!reason || !canMarkLost) return;
    setError(null);
    startTransition(async () => {
      const result = await markQuoteLostAction(quoteId, {
        reason,
        note: reason === "OTHER" ? note : undefined,
      });
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setLostOpen(false);
      setReason("");
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          setReason("");
          setNote("");
          setLostOpen(true);
        }}
      >
        Mark lost
      </Button>
      {isAdmin && (
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this quote? This cannot be undone.")) {
              run(() => deleteQuoteAction(quoteId), "/");
            }
          }}
        >
          Delete
        </Button>
      )}
      {error && !lostOpen && <p className="text-sm text-red-600">{error}</p>}

      <Modal
        title="Mark quote as lost"
        open={lostOpen}
        onClose={() => {
          if (pending) return;
          setLostOpen(false);
        }}
      >
        <p className="text-sm text-slate-600">
          Select why this quote was lost. This helps track win/loss patterns.
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium text-slate-700">Lost reason</legend>
          {LOST_REASON_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
            >
              <input
                type="radio"
                name="lostReason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                disabled={pending}
              />
              {LOST_REASON_LABELS[option]}
            </label>
          ))}
        </fieldset>

        {reason === "OTHER" ? (
          <div className="mt-4">
            <Textarea
              label="Please describe"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              disabled={pending}
              placeholder="Brief reason…"
            />
          </div>
        ) : null}

        {error && lostOpen && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setLostOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending || !canMarkLost}
            onClick={markLost}
          >
            {pending ? "Saving…" : "Mark lost"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
