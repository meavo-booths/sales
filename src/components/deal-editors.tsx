"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BoothUnitStatus, PaymentStatus } from "@prisma/client";
import {
  retryOpsSheetSyncAction,
  updateBoothUnitAction,
  updateDealContactsAction,
  updateDealDetailsAction,
  updateDealReadyAction,
  updatePaymentAction,
} from "@/app/actions/deals";
import {
  BOOTH_UNIT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERMS_LABELS,
  formatDate,
} from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

export type DealDetailsValues = {
  dealDate: string;
  salesRep: string;
  market: string;
  clientName: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  paymentTerms: "UPFRONT_100" | "SPLIT_50_50" | "NET_30";
  vatNumber: string;
  registeredAddress: string;
  assemblyAddress: string;
};

export type DealContactValues = {
  kind: "MAIN" | "FINANCE";
  name: string;
  email: string;
  phone: string;
  role: string;
};

const EMPTY_CONTACT: DealContactValues = {
  kind: "MAIN",
  name: "",
  email: "",
  phone: "",
  role: "",
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export function DealDetailsEditorCard({
  dealId,
  details,
}: {
  dealId: string;
  details: DealDetailsValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<DealDetailsValues>(details);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof DealDetailsValues>(key: K, value: DealDetailsValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDealDetailsAction(dealId, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Details</h2>
        <Button
          variant="secondary"
          onClick={() => {
            setValues(details);
            setError(null);
            setEditing((v) => !v);
          }}
        >
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {!editing ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Deal date" value={formatDate(new Date(details.dealDate))} />
          <DetailField label="Sales rep" value={details.salesRep} />
          <DetailField label="Market" value={details.market} />
          <DetailField label="Client type" value={CLIENT_TYPE_LABELS[details.clientType]} />
          <DetailField label="Payment terms" value={PAYMENT_TERMS_LABELS[details.paymentTerms]} />
          <DetailField label="VAT number" value={details.vatNumber} />
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailField label="Registered address (invoicing)" value={details.registeredAddress} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailField label="Assembly address" value={details.assemblyAddress} />
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Deal date"
              type="date"
              value={values.dealDate}
              onChange={(e) => set("dealDate", e.target.value)}
              required
            />
            <Input
              label="Sales rep"
              value={values.salesRep}
              onChange={(e) => set("salesRep", e.target.value)}
            />
            <Input
              label="Market"
              value={values.market}
              onChange={(e) => set("market", e.target.value)}
            />
            <Select
              label="Client type"
              value={values.clientType}
              onChange={(e) => set("clientType", e.target.value as DealDetailsValues["clientType"])}
            >
              {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Payment terms"
              value={values.paymentTerms}
              onChange={(e) =>
                set("paymentTerms", e.target.value as DealDetailsValues["paymentTerms"])
              }
            >
              {Object.entries(PAYMENT_TERMS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              label="VAT number"
              value={values.vatNumber}
              onChange={(e) => set("vatNumber", e.target.value)}
            />
            <Input
              label="Client name"
              value={values.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              required
            />
          </div>
          <Textarea
            label="Registered address (invoicing)"
            rows={2}
            value={values.registeredAddress}
            onChange={(e) => set("registeredAddress", e.target.value)}
          />
          <Textarea
            label="Assembly address (where the booths get installed)"
            rows={2}
            value={values.assemblyAddress}
            onChange={(e) => set("assemblyAddress", e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ReadyToAssembleToggle({
  dealId,
  ready,
}: {
  dealId: string;
  ready: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState(ready);
  const [error, setError] = useState<string | null>(null);

  const toggle = (next: boolean) => {
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const result = await updateDealReadyAction(dealId, next);
      if (!result.ok) {
        setChecked(ready);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
          checked
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        } ${pending ? "opacity-60" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Ready to assemble
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function DealContactsEditorCard({
  dealId,
  contacts,
}: {
  dealId: string;
  contacts: DealContactValues[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<DealContactValues[]>(contacts);
  const [error, setError] = useState<string | null>(null);

  const setContact = (index: number, patch: Partial<DealContactValues>) =>
    setDrafts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateDealContactsAction(dealId, { contacts: drafts });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Contacts</h2>
        <Button
          variant="secondary"
          onClick={() => {
            setDrafts(contacts.length > 0 ? contacts.map((c) => ({ ...c })) : [{ ...EMPTY_CONTACT }]);
            setError(null);
            setEditing((v) => !v);
          }}
        >
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {!editing ? (
        contacts.length === 0 ? (
          <p className="text-sm text-slate-500">No contacts.</p>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact, index) => (
              <li key={index} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{contact.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {CONTACT_KIND_LABELS[contact.kind]}
                  </span>
                  {contact.role && <span className="text-xs text-slate-500">{contact.role}</span>}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          {drafts.map((contact, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  aria-label="Contact type"
                  value={contact.kind}
                  onChange={(e) =>
                    setContact(index, { kind: e.target.value as DealContactValues["kind"] })
                  }
                >
                  <option value="MAIN">Main contact</option>
                  <option value="FINANCE">Finance contact</option>
                </Select>
                <Input
                  placeholder="Name"
                  value={contact.name}
                  onChange={(e) => setContact(index, { name: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact(index, { email: e.target.value })}
                />
                <Input
                  placeholder="Phone"
                  value={contact.phone}
                  onChange={(e) => setContact(index, { phone: e.target.value })}
                />
                <Input
                  placeholder="Role"
                  value={contact.role}
                  onChange={(e) => setContact(index, { role: e.target.value })}
                />
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    onClick={() => setDrafts((prev) => prev.filter((_, i) => i !== index))}
                    disabled={drafts.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setDrafts((prev) => [...prev, { ...EMPTY_CONTACT }])}
            >
              Add contact
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}

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
        label="Deal Notes"
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
  const [error, setError] = useState<string | null>(null);

  const save = (nextStatus: BoothUnitStatus, nextLocation: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateBoothUnitAction(unitId, {
        status: nextStatus,
        location: nextLocation,
      });
      if (!result.ok) {
        setError(result.error);
        setStatusValue(status);
        setLocationValue(location);
        return;
      }
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
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
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
