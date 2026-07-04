"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createQuoteAction, updateQuoteAction } from "@/app/actions/quotes";
import {
  CLIENT_TYPE_LABELS,
  FINISH_LABELS,
  PAYMENT_TERMS_LABELS,
  formatMoney,
} from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  listPrice: number;
};

type ContactDraft = {
  kind: "MAIN" | "FINANCE";
  name: string;
  email: string;
  phone: string;
  role: string;
};

type LineItemDraft = {
  productId: string;
  quantity: number;
  unitPrice: number;
  finish: "CUSTOM" | "WHITE_STOCK" | "BLACK_STOCK" | "LDF_COLOUR";
  finishDetails: string;
  description: string;
};

export type QuoteFormValues = {
  dealDate: string;
  salesRep: string;
  market: string;
  clientName: string;
  registeredAddress: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  paymentTerms: "UPFRONT_100" | "SPLIT_50_50" | "NET_30";
  notes: string;
  contacts: ContactDraft[];
  lineItems: LineItemDraft[];
};

const EMPTY_CONTACT: ContactDraft = { kind: "MAIN", name: "", email: "", phone: "", role: "" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuoteForm({
  products,
  quoteId,
  initialValues,
  defaultSalesRep,
}: {
  products: ProductOption[];
  quoteId?: string;
  initialValues?: QuoteFormValues;
  defaultSalesRep?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<QuoteFormValues>(
    initialValues ?? {
      dealDate: today(),
      salesRep: defaultSalesRep ?? "",
      market: "",
      clientName: "",
      registeredAddress: "",
      vatNumber: "",
      clientType: "DIRECT",
      paymentTerms: "UPFRONT_100",
      notes: "",
      contacts: [{ ...EMPTY_CONTACT }],
      lineItems: [],
    },
  );

  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const setContact = (index: number, patch: Partial<ContactDraft>) =>
    setValues((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const setLineItem = (index: number, patch: Partial<LineItemDraft>) =>
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    }));

  const addLineItem = () => {
    const first = products[0];
    if (!first) return;
    setValues((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          productId: first.id,
          quantity: 1,
          unitPrice: first.listPrice,
          finish: "WHITE_STOCK",
          finishDetails: "",
          description: "",
        },
      ],
    }));
  };

  const total = values.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = quoteId
        ? await updateQuoteAction(quoteId, values)
        : await createQuoteAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/quotes/${result.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Deal details</h2>
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
            placeholder="e.g. Germany"
          />
          <Select
            label="Client type"
            value={values.clientType}
            onChange={(e) => set("clientType", e.target.value as QuoteFormValues["clientType"])}
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
            onChange={(e) => set("paymentTerms", e.target.value as QuoteFormValues["paymentTerms"])}
          >
            {Object.entries(PAYMENT_TERMS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Client</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Client name"
            value={values.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            required
          />
          <Input
            label="VAT number"
            value={values.vatNumber}
            onChange={(e) => set("vatNumber", e.target.value)}
          />
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
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    contacts: prev.contacts.filter((_, i) => i !== index),
                  }))
                }
                disabled={values.contacts.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() =>
              setValues((prev) => ({ ...prev, contacts: [...prev.contacts, { ...EMPTY_CONTACT }] }))
            }
          >
            Add contact
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Line items</h2>
          <Button variant="secondary" onClick={addLineItem} disabled={products.length === 0}>
            Add line item
          </Button>
        </div>

        {products.length === 0 && (
          <p className="text-sm text-amber-700">
            No active products in the catalog. Add products first.
          </p>
        )}

        {values.lineItems.length === 0 ? (
          <p className="text-sm text-slate-500">No line items yet.</p>
        ) : (
          <div className="space-y-3">
            {values.lineItems.map((item, index) => (
              <div key={index} className="rounded-lg border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
                  <Select
                    label="Product"
                    value={item.productId}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value);
                      setLineItem(index, {
                        productId: e.target.value,
                        unitPrice: product ? product.listPrice : item.unitPrice,
                      });
                    }}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setLineItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <Input
                    label="Unit price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => setLineItem(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Select
                    label="Finish"
                    value={item.finish}
                    onChange={(e) =>
                      setLineItem(index, { finish: e.target.value as LineItemDraft["finish"] })
                    }
                  >
                    {Object.entries(FINISH_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          lineItems: prev.lineItems.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    label="Finish details"
                    value={item.finishDetails}
                    onChange={(e) => setLineItem(index, { finishDetails: e.target.value })}
                    placeholder="e.g. RAL 7016"
                  />
                  <Input
                    label="Description override"
                    value={item.description}
                    onChange={(e) => setLineItem(index, { description: e.target.value })}
                    placeholder="Optional — shown on the quote PDF"
                  />
                </div>
                <p className="mt-2 text-right text-sm font-medium text-slate-700">
                  {formatMoney(item.quantity * item.unitPrice)}
                </p>
              </div>
            ))}
            <p className="text-right text-base font-semibold text-slate-900">
              Total: {formatMoney(total)}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <Textarea
          label="Notes"
          rows={3}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Internal notes, delivery expectations, special requests…"
        />
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : quoteId ? "Save changes" : "Create quote"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
