"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BoothUnitStatus, PaymentStatus } from "@prisma/client";
import {
  retryOpsSheetSyncAction,
  updateBoothUnitAction,
  updatePaymentAction,
} from "@/app/actions/deals";
import {
  BOOTH_UNIT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/deal-values";
import { Button, Input, Select, Textarea } from "@/components/ui";

export function PaymentEditor({
  dealId,
  paymentStatus,
  paymentPoDate,
  notes,
}: {
  dealId: string;
  paymentStatus: PaymentStatus;
  paymentPoDate: string;
  notes: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PaymentStatus>(paymentStatus);
  const [poDate, setPoDate] = useState(paymentPoDate);
  const [notesValue, setNotesValue] = useState(notes);
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePaymentAction(dealId, {
        paymentStatus: status,
        paymentPoDate: poDate || null,
        notes: notesValue,
      });
      setMessage(result.ok ? "Saved." : result.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus)}
        >
          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Payment / PO date"
          type="date"
          value={poDate}
          onChange={(e) => setPoDate(e.target.value)}
        />
      </div>
      <Textarea
        label="Notes"
        rows={3}
        value={notesValue}
        onChange={(e) => setNotesValue(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {message && (
          <p className={`text-sm ${message === "Saved." ? "text-green-700" : "text-red-600"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export function BoothUnitEditor({
  unitId,
  status,
  location,
}: {
  unitId: string;
  status: BoothUnitStatus;
  location: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusValue, setStatusValue] = useState<BoothUnitStatus>(status);
  const [locationValue, setLocationValue] = useState(location);

  const save = (nextStatus: BoothUnitStatus, nextLocation: string) => {
    startTransition(async () => {
      await updateBoothUnitAction(unitId, { status: nextStatus, location: nextLocation });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Booth status"
        value={statusValue}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as BoothUnitStatus;
          setStatusValue(next);
          save(next, locationValue);
        }}
        className="w-40"
      >
        {Object.entries(BOOTH_UNIT_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Input
        aria-label="Location"
        placeholder="Location"
        value={locationValue}
        disabled={pending}
        onChange={(e) => setLocationValue(e.target.value)}
        onBlur={() => {
          if (locationValue !== location) save(statusValue, locationValue);
        }}
        className="w-40"
      />
    </div>
  );
}

export function RetrySheetSyncButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await retryOpsSheetSyncAction(dealId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Syncing…" : "Retry Ops File sync"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
