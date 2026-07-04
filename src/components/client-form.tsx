"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClientAction, updateClientAction } from "@/app/actions/clients";
import { CLIENT_TYPE_LABELS } from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

type ContactDraft = {
  kind: "MAIN" | "FINANCE";
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
  contacts: [],
};

export function ClientForm({
  clientId,
  initialValues,
  title,
}: {
  clientId?: string;
  initialValues?: ClientFormValues;
  title?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<ClientFormValues>(initialValues ?? EMPTY_VALUES);

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
      // Rows without a name would fail validation — drop them silently.
      const input = { ...values, contacts: values.contacts.filter((c) => c.name.trim()) };
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
      } else {
        router.push(`/clients/${result.id}`);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">
        {title ?? (clientId ? "Client details" : "Add client")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Client name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
        <Input
          label="Market"
          value={values.market}
          onChange={(e) => set("market", e.target.value)}
          placeholder="e.g. Germany"
        />
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
        <Input
          label="VAT number"
          value={values.vatNumber}
          onChange={(e) => set("vatNumber", e.target.value)}
        />
        <Input
          label="Website"
          value={values.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder="https://…"
        />
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={values.isVip}
            onChange={(e) => set("isVip", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          VIP client
        </label>
        <div className="sm:col-span-2">
          <Textarea
            label="Registered address"
            rows={2}
            value={values.registeredAddress}
            onChange={(e) => set("registeredAddress", e.target.value)}
          />
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Contacts</h3>
      {values.contacts.length === 0 && (
        <p className="mb-2 text-sm text-slate-500">No contacts yet.</p>
      )}
      <div className="space-y-3">
        {values.contacts.map((contact, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[repeat(5,1fr)_auto]"
          >
            <Select
              aria-label="Contact type"
              value={contact.kind}
              onChange={(e) => setContact(index, { kind: e.target.value as ContactDraft["kind"] })}
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
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : clientId ? "Save changes" : "Add client"}
        </Button>
      </div>
    </Card>
  );
}
