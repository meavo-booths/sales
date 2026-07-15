"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BoothUnitStatus, DealContactKind, DeliveryType, PaymentStatus, PaymentTerms } from "@prisma/client";
import {
  deleteWonDealAction,
  retryOpsSheetSyncAction,
  updateBoothUnitAction,
  updateDealContactsAction,
  updateDealAssemblyAndNotesAction,
  updateDealDetailsAction,
  updateDealReadyAction,
  updatePaymentAction,
} from "@/app/actions/deals";
import {
  createXeroFinalInvoiceAction,
  createXeroInvoiceAction,
  syncDealPaymentFromXeroAction,
} from "@/app/actions/xero";
import { retryZampSyncAction } from "@/app/actions/zamp";
import {
  BOOTH_UNIT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPE_OPTIONS,
  MARKET_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERMS_FORM_OPTIONS,
  PAYMENT_TERMS_LABELS,
  SOCKET_TYPE_OPTIONS,
  formatDate,
} from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import type { XeroPaymentBreakdown } from "@/lib/xero/sync-payment";
import { formatPaymentBreakdownLine } from "@/lib/xero/sync-payment";
import { DealField, DealFieldGrid, DealSubsection } from "@/components/deal-layout";
import { VatNumberField } from "@/components/vat-check";
import { isUsMarket } from "@/lib/zamp/constants";
import { stateFromZip, US_STATES } from "@/lib/us-state";

export type DealDetailsValues = {
  dealDate: string;
  salesRep: string;
  market: string;
  usState: string;
  shipToLine1: string;
  shipToLine2: string;
  shipToCity: string;
  shipToZip: string;
  clientName: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  paymentTerms: PaymentTerms;
  vatNumber: string;
  registeredAddress: string;
  website: string;
  socketType: string;
  targetDeliveryDate: string;
  deliveryType: DeliveryType | "";
};

export type DealAssemblyNotesValues = {
  assemblyAddress: string;
  notes: string;
  clientPo: string;
  actualClient: string;
};

export type DealContactValues = {
  kind: DealContactKind;
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
        <h2 className="text-base font-semibold text-slate-900">Deal & client</h2>
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
        <div className="space-y-4">
          <DealSubsection title="Commercial">
            <DealFieldGrid columns="sm:grid-cols-2 lg:grid-cols-3">
              <DealField label="Deal date" value={formatDate(new Date(details.dealDate))} />
              <DealField label="Sales rep" value={details.salesRep} />
              <DealField label="Market" value={details.market} />
              <DealField label="Client name" value={details.clientName} />
              <DealField label="Client type" value={CLIENT_TYPE_LABELS[details.clientType]} />
              <DealField
                label="Payment terms"
                value={PAYMENT_TERMS_LABELS[details.paymentTerms]}
              />
              <DealField label="VAT number" value={details.vatNumber} />
              <DealField label="URL" value={details.website} />
              <div className="sm:col-span-2 lg:col-span-3">
                <DealField
                  label="Registered address (invoicing)"
                  value={details.registeredAddress}
                />
              </div>
            </DealFieldGrid>
          </DealSubsection>
          <DealSubsection title="Technical & delivery">
            <DealFieldGrid columns="sm:grid-cols-2 lg:grid-cols-3">
              <DealField label="Socket type" value={details.socketType} />
              <DealField
                label="Target delivery"
                value={
                  details.targetDeliveryDate
                    ? formatDate(new Date(details.targetDeliveryDate))
                    : ""
                }
              />
              <DealField
                label="Delivery type"
                value={
                  details.deliveryType ? DELIVERY_TYPE_LABELS[details.deliveryType] : ""
                }
              />
              {isUsMarket(details.market) && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <DealField
                    label="US ship-to address"
                    value={[
                      details.shipToLine1,
                      details.shipToLine2,
                      [details.shipToCity, details.usState, details.shipToZip]
                        .filter(Boolean)
                        .join(", "),
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  />
                </div>
              )}
            </DealFieldGrid>
          </DealSubsection>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Select
              label="Market"
              value={values.market}
              onChange={(e) => set("market", e.target.value)}
            >
              <option value="">Select market…</option>
              {values.market && !MARKET_OPTIONS.includes(values.market as never) && (
                <option value={values.market}>{values.market}</option>
              )}
              {MARKET_OPTIONS.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </Select>
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
              {PAYMENT_TERMS_FORM_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_TERMS_LABELS[value]}
                </option>
              ))}
            </Select>
            <VatNumberField
              value={values.vatNumber}
              onChange={(value) => set("vatNumber", value)}
            />
            <Input
              label="Client name"
              value={values.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              required
            />
            <Select
              label="Socket type"
              value={values.socketType}
              onChange={(e) => set("socketType", e.target.value)}
            >
              <option value="">Select socket type…</option>
              {values.socketType &&
                !SOCKET_TYPE_OPTIONS.includes(
                  values.socketType as (typeof SOCKET_TYPE_OPTIONS)[number],
                ) && <option value={values.socketType}>{values.socketType}</option>}
              {SOCKET_TYPE_OPTIONS.map((socket) => (
                <option key={socket} value={socket}>
                  {socket}
                </option>
              ))}
            </Select>
            <Input
              label="Target delivery"
              type="date"
              value={values.targetDeliveryDate}
              onChange={(e) => set("targetDeliveryDate", e.target.value)}
            />
            <Select
              label="Delivery type"
              value={values.deliveryType}
              onChange={(e) =>
                set("deliveryType", e.target.value as DealDetailsValues["deliveryType"])
              }
              required
            >
              <option value="" disabled>
                Select delivery type…
              </option>
              {values.deliveryType &&
                !DELIVERY_TYPE_OPTIONS.includes(
                  values.deliveryType as (typeof DELIVERY_TYPE_OPTIONS)[number],
                ) && <option value={values.deliveryType}>{values.deliveryType}</option>}
              {DELIVERY_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {DELIVERY_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Input
              label="URL"
              type="url"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <Textarea
            label="Registered address (invoicing)"
            rows={2}
            value={values.registeredAddress}
            onChange={(e) => set("registeredAddress", e.target.value)}
          />
          {isUsMarket(values.market) && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">US ship-to address</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Address line 1"
                  value={values.shipToLine1}
                  onChange={(e) => set("shipToLine1", e.target.value)}
                />
                <Input
                  label="Address line 2"
                  value={values.shipToLine2}
                  onChange={(e) => set("shipToLine2", e.target.value)}
                  placeholder="Optional"
                />
                <Input
                  label="City"
                  value={values.shipToCity}
                  onChange={(e) => set("shipToCity", e.target.value)}
                />
                <Input
                  label="ZIP code"
                  value={values.shipToZip}
                  onChange={(e) => {
                    const zip = e.target.value;
                    set("shipToZip", zip);
                    const inferred = stateFromZip(zip);
                    if (inferred) set("usState", inferred);
                  }}
                />
                <Select
                  label="State"
                  value={values.usState}
                  onChange={(e) => set("usState", e.target.value)}
                >
                  <option value="">Select state…</option>
                  {values.usState &&
                    !US_STATES.some((state) => state.code === values.usState) && (
                      <option value={values.usState}>{values.usState}</option>
                    )}
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.code} — {state.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function DealDeliveryNotesCard({
  dealId,
  values: initialValues,
}: {
  dealId: string;
  values: DealAssemblyNotesValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<string | null>(null);

  const set = <K extends keyof DealAssemblyNotesValues>(key: K, value: DealAssemblyNotesValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateDealAssemblyAndNotesAction(dealId, values);
      setMessage(result.ok ? "Saved." : result.error);
      router.refresh();
    });
  };

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Delivery & notes</h2>
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea
            label="Deal notes"
            rows={4}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Internal notes, delivery expectations, special requests…"
          />
          <div className="space-y-3">
            <Textarea
              label="Assembly address"
              rows={4}
              value={values.assemblyAddress}
              onChange={(e) => set("assemblyAddress", e.target.value)}
              placeholder="Where the booths get installed"
            />
            <Input
              label="Client PO"
              value={values.clientPo}
              onChange={(e) => set("clientPo", e.target.value)}
              placeholder="Customer purchase order"
            />
            <Input
              label="Actual client"
              value={values.actualClient}
              onChange={(e) => set("actualClient", e.target.value)}
              placeholder="End customer if billed via agency"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {message && (
            <p className={`text-sm ${message === "Saved." ? "text-green-700" : "text-red-600"}`}>
              {message}
            </p>
          )}
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** @deprecated Use DealDeliveryNotesCard */
export const AssemblyAndNotesEditorRow = DealDeliveryNotesCard;

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

function DealContactsEditorBody({
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
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">Contacts</h3>
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
          <ul className="divide-y divide-slate-100">
            {contacts.map((contact, index) => (
              <li key={index} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{contact.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {CONTACT_KIND_LABELS[contact.kind]}
                  </span>
                  {contact.role && <span className="text-xs text-slate-500">{contact.role}</span>}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
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
                  {Object.entries(CONTACT_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
    </>
  );
}

export function DealPeopleBillingCard({
  dealId,
  contacts,
  paymentStatus,
  paymentPoDate,
  paymentTerms,
  xeroPaymentSyncedAt,
  xeroInvoiceId,
  xeroPaymentBreakdown,
}: {
  dealId: string;
  contacts: DealContactValues[];
  paymentStatus: PaymentStatus;
  paymentPoDate: string;
  paymentTerms: PaymentTerms;
  xeroPaymentSyncedAt: string | null;
  xeroInvoiceId: string | null;
  xeroPaymentBreakdown: XeroPaymentBreakdown | null;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Contacts & billing</h2>
      <div className="space-y-6">
        <DealContactsEditorBody dealId={dealId} contacts={contacts} />
        <div className="border-t border-slate-100 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Payment</h3>
          <PaymentEditor
            dealId={dealId}
            paymentStatus={paymentStatus}
            paymentPoDate={paymentPoDate}
            paymentTerms={paymentTerms}
            xeroPaymentSyncedAt={xeroPaymentSyncedAt}
            xeroInvoiceId={xeroInvoiceId}
            xeroPaymentBreakdown={xeroPaymentBreakdown}
          />
        </div>
      </div>
    </Card>
  );
}

export function DealContactsEditorCard({
  dealId,
  contacts,
}: {
  dealId: string;
  contacts: DealContactValues[];
}) {
  return (
    <Card>
      <DealContactsEditorBody dealId={dealId} contacts={contacts} />
    </Card>
  );
}

function PaymentBreakdownList({
  paymentTerms,
  breakdown,
}: {
  paymentTerms: PaymentTerms;
  breakdown: XeroPaymentBreakdown;
}) {
  const lines =
    paymentTerms === "SPLIT_50_50"
      ? [
          formatPaymentBreakdownLine("Advance", breakdown.advance.number, breakdown.advance.state),
          formatPaymentBreakdownLine("Final", breakdown.final.number, breakdown.final.state),
        ]
      : [
          formatPaymentBreakdownLine(
            "Invoice",
            breakdown.advance.number,
            breakdown.advance.state,
          ),
        ];

  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line) => (
        <li key={line} className="text-slate-700">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function PaymentEditor({
  dealId,
  paymentStatus,
  paymentPoDate,
  paymentTerms,
  xeroPaymentSyncedAt,
  xeroInvoiceId,
  xeroPaymentBreakdown,
}: {
  dealId: string;
  paymentStatus: PaymentStatus;
  paymentPoDate: string;
  paymentTerms: PaymentTerms;
  xeroPaymentSyncedAt: string | null;
  xeroInvoiceId: string | null;
  xeroPaymentBreakdown: XeroPaymentBreakdown | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshPending, startRefresh] = useTransition();
  const [status, setStatus] = useState<PaymentStatus>(paymentStatus);
  const [poDate, setPoDate] = useState(paymentPoDate);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const locked = Boolean(xeroPaymentSyncedAt);
  const canRefresh = Boolean(xeroInvoiceId);

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePaymentAction(dealId, {
        paymentStatus: status,
        paymentPoDate: poDate || null,
      });
      setMessage(result.ok ? "Saved." : result.error);
      router.refresh();
    });
  };

  const refreshFromXero = () => {
    setRefreshError(null);
    startRefresh(async () => {
      const result = await syncDealPaymentFromXeroAction(dealId);
      if (!result.ok) setRefreshError(result.error);
      router.refresh();
    });
  };

  if (locked) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Payment status
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-900">
            {PAYMENT_STATUS_LABELS[paymentStatus]}
          </p>
          <p className="mt-1 text-xs text-slate-600">Synced from Xero</p>
        </div>

        {xeroPaymentBreakdown && (
          <PaymentBreakdownList paymentTerms={paymentTerms} breakdown={xeroPaymentBreakdown} />
        )}

        {paymentPoDate && (
          <p className="text-sm text-slate-600">
            Payment / PO date: {formatDate(new Date(`${paymentPoDate}T00:00:00.000Z`))}
          </p>
        )}

        {canRefresh && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={refreshPending} onClick={refreshFromXero}>
              {refreshPending ? "Refreshing…" : "Refresh from Xero"}
            </Button>
            {refreshError && <p className="text-sm text-red-600">{refreshError}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canRefresh && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={refreshPending} onClick={refreshFromXero}>
            {refreshPending ? "Syncing…" : "Sync from Xero"}
          </Button>
          {refreshError && <p className="text-sm text-red-600">{refreshError}</p>}
        </div>
      )}

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

export function RetryZampSyncButton({ dealId }: { dealId: string }) {
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
            const result = await retryZampSyncAction(dealId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Syncing…" : "Retry Zamp sync"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CreateXeroInvoiceButton({
  dealId,
  label = "Create invoice",
}: {
  dealId: string;
  label?: string;
}) {
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
            const result = await createXeroInvoiceAction(dealId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Creating…" : label}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CreateXeroFinalInvoiceButton({ dealId }: { dealId: string }) {
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
            const result = await createXeroFinalInvoiceAction(dealId);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        {pending ? "Creating…" : "Create final invoice"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function RetryXeroInvoiceButton({ dealId }: { dealId: string }) {
  return <CreateXeroInvoiceButton dealId={dealId} label="Retry Xero invoice" />;
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

export function DealDeleteButton({ dealId }: { dealId: string }) {
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
              "Delete this deal and all its line items? This cannot be undone. " +
                "Xero invoices and Ops sheet rows are not removed from external systems.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deleteWonDealAction(dealId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/deals");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete deal"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
