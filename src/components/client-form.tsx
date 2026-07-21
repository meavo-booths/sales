"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DealContactKind } from "@prisma/client";
import {
  createClientAction,
  updateClientAction,
  type ParentCompanyOption,
} from "@/app/actions/clients";
import { CLIENT_TYPE_LABELS, CONTACT_KIND_LABELS, CLIENT_MARKET_OPTIONS } from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { VatNumberField } from "@/components/vat-check";

type ContactDraft = {
  kind: DealContactKind;
  name: string;
  email: string;
  phone: string;
  role: string;
};

export type ClientFormValues = {
  name: string;
  registeredAddress: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  market: string;
  website: string;
  isVip: boolean;
  parentClientId: string | null;
  isGroupAccount: boolean;
  contacts: ContactDraft[];
};

const EMPTY_CONTACT: ContactDraft = { kind: "MAIN", name: "", email: "", phone: "", role: "" };

const EMPTY_VALUES: ClientFormValues = {
  name: "",
  registeredAddress: "",
  vatNumber: "",
  clientType: "DIRECT",
  market: "",
  website: "",
  isVip: false,
  parentClientId: null,
  isGroupAccount: false,
  contacts: [],
};

export function ClientForm({
  clientId,
  initialValues,
  title,
  noCard = false,
  isGroupHead = false,
  parentOptions = [],
  onCreated,
}: {
  clientId?: string;
  initialValues?: ClientFormValues;
  title?: string;
  /** When true, skip the outer Card wrapper (e.g. inside a modal). */
  noCard?: boolean;
  /** Existing group head with subsidiaries — locks parent picker and billing fields. */
  isGroupHead?: boolean;
  parentOptions?: ParentCompanyOption[];
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<ClientFormValues>(initialValues ?? EMPTY_VALUES);

  const showBillingFields = !values.isGroupAccount && !isGroupHead;
  const showParentPicker = !values.isGroupAccount && !isGroupHead && parentOptions.length > 0;

  const set = <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const setContact = (index: number, patch: Partial<ContactDraft>) => {
    setSaved(false);
    setValues((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const submit = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const input = {
        ...values,
        contacts: values.contacts.filter((c) => c.name.trim()),
        parentClientId: values.isGroupAccount ? null : values.parentClientId,
      };
      const result = clientId
        ? await updateClientAction(clientId, input)
        : await createClientAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (clientId) {
        setSaved(true);
        router.refresh();
      } else if (onCreated) {
        setValues(EMPTY_VALUES);
        onCreated();
        router.refresh();
      } else {
        router.push(`/clients/${result.id}`);
        router.refresh();
      }
    });
  };

  const heading =
    title === undefined ? (clientId ? "Client details" : "Add client") : title;

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
    >
      {heading ? (
        <h2 className="mb-4 text-base font-semibold text-slate-900">{heading}</h2>
      ) : null}

      {!clientId && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                isGroupAccount: !prev.isGroupAccount,
                parentClientId: null,
                vatNumber: prev.isGroupAccount ? prev.vatNumber : "",
                registeredAddress: prev.isGroupAccount ? prev.registeredAddress : "",
              }))
            }
            aria-pressed={values.isGroupAccount}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              values.isGroupAccount
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            This is a parent / group account
          </button>
          {values.isGroupAccount && (
            <p className="mt-2 text-sm text-slate-500">
              Group accounts are for rollup stats and shared contacts. Add subsidiaries separately
              and link quotes to the local company.
            </p>
          )}
        </div>
      )}

      {isGroupHead && (
        <p className="mb-4 text-sm text-slate-500">
          This is a group head with subsidiaries. Billing fields are optional; create quotes on
          subsidiary records.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Client name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
        <Select
          label="Market"
          value={values.market}
          onChange={(e) => set("market", e.target.value)}
        >
          <option value="">Select market…</option>
          {/* Legacy markets outside the fixed list stay selectable. */}
          {values.market && !CLIENT_MARKET_OPTIONS.includes(values.market as never) && (
            <option value={values.market}>{values.market}</option>
          )}
          {CLIENT_MARKET_OPTIONS.map((market) => (
            <option key={market} value={market}>
              {market}
            </option>
          ))}
        </Select>
        {showParentPicker && (
          <div className="sm:col-span-2">
            <Select
              label="Parent company"
              value={values.parentClientId ?? ""}
              onChange={(e) => set("parentClientId", e.target.value || null)}
            >
              <option value="">None (standalone)</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Select
          label="Client type"
          value={values.clientType}
          onChange={(e) => set("clientType", e.target.value as ClientFormValues["clientType"])}
        >
          {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {showBillingFields && (
          <VatNumberField
            value={values.vatNumber}
            onChange={(value) => set("vatNumber", value)}
          />
        )}
        <Input
          label="Website"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder="https://…"
        />
        <div className="flex items-end pb-1">
          <button
            type="button"
            onClick={() => set("isVip", !values.isVip)}
            aria-pressed={values.isVip}
            title={values.isVip ? "Click to remove the VIP label" : "Click to mark as VIP"}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              values.isVip
                ? "bg-gradient-to-r from-amber-200 via-yellow-100 to-emerald-200 text-emerald-900 ring-1 ring-amber-400/60 shadow-sm"
                : "border border-slate-300 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            ★ VIP client
          </button>
        </div>
        {showBillingFields && (
          <div className="sm:col-span-2">
            <Textarea
              label="Registered address"
              rows={2}
              value={values.registeredAddress}
              onChange={(e) => set("registeredAddress", e.target.value)}
            />
          </div>
        )}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Contacts</h3>
      {values.contacts.length === 0 && (
        <p className="mb-2 text-sm text-slate-500">No contacts yet.</p>
      )}
      <div className="space-y-3">
        {values.contacts.map((contact, index) => (
          <div
            key={index}
            className={`grid gap-2 rounded-lg border border-slate-200 p-3 ${
              noCard
                ? "lg:grid-cols-[11rem_repeat(4,minmax(0,1fr))_auto]"
                : "sm:grid-cols-[repeat(5,1fr)_auto]"
            }`}
          >
            <Select
              aria-label="Contact type"
              value={contact.kind}
              onChange={(e) => setContact(index, { kind: e.target.value as ContactDraft["kind"] })}
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
            <Button
              variant="ghost"
              onClick={() => {
                setSaved(false);
                setValues((prev) => ({
                  ...prev,
                  contacts: prev.contacts.filter((_, i) => i !== index),
                }));
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button
          variant="secondary"
          onClick={() => {
            setSaved(false);
            setValues((prev) => ({ ...prev, contacts: [...prev.contacts, { ...EMPTY_CONTACT }] }));
          }}
        >
          Add contact
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-700">Saved.</p>}

      <div className="mt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : clientId ? "Save changes" : "Add client"}
        </Button>
      </div>
    </form>
  );

  if (noCard) return form;
  return <Card>{form}</Card>;
}
