"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteClientAction } from "@/app/actions/clients";
import { Button } from "@/components/ui";

export function ClientDeleteButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Delete “${clientName}”? This cannot be undone. ` +
                "Contacts on this record are removed. Quotes/deals that used this client keep their saved name and details. " +
                "Xero contacts are not removed from Xero.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deleteClientAction(clientId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/clients");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete client"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
