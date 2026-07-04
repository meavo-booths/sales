"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteQuoteAction } from "@/app/actions/quotes";
import { markQuoteLostAction } from "@/app/actions/deals";
import { Button } from "@/components/ui";

export function QuoteSecondaryActions({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (confirm("Mark this quote as lost?")) {
            run(() => markQuoteLostAction(quoteId));
          }
        }}
      >
        Mark lost
      </Button>
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
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
