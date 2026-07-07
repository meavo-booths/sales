"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DealContactKind } from "@prisma/client";
import { createQuoteAction, updateQuoteAction } from "@/app/actions/quotes";
import {
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  FINISH_LABELS,
  MARKET_OPTIONS,
  PAYMENT_TERMS_LABELS,
  SOCKET_TYPE_OPTIONS,
  formatMoney,
} from "@/lib/deal-values";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { VatNumberField } from "@/components/vat-check";

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  kind: "BOOTH" | "ADDON";
  listPrice: number;
  /** For add-ons: booth product ids this add-on is limited to. Empty = any booth. */
  restrictedToBoothIds: string[];
};

type ContactDraft = {
  kind: DealContactKind;
  name: string;
  email: string;
  phone: string;
  role: string;
};

export type ClientOption = {
  id: string;
  name: string;
  registeredAddress: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  market: string;
  isVip: boolean;
  contacts: ContactDraft[];
};

type CustomLineDraft = {
  name: string;
  quantity: number;
  unitPrice: number;
  description: string;
};

type AddOnDraft = {
  productId: string;
  quantity: number;
  unitPrice: number;
  description: string;
};

type LineItemDraft = {
  productId: string;
  quantity: number;
  unitPrice: number;
  finish: "CUSTOM" | "WHITE_STOCK" | "BLACK_STOCK" | "LDF_COLOUR";
  finishDetails: string;
  description: string;
  addOns: AddOnDraft[];
};

export type QuoteFormValues = {
  clientId: string | null;
  dealDate: string;
  salesRep: string;
  market: string;
  usState: string;
  clientName: string;
  registeredAddress: string;
  assemblyAddress: string;
  socketType: string;
  targetDeliveryDate: string;
  vatNumber: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
  isVip: boolean;
  paymentTerms: "UPFRONT_100" | "SPLIT_50_50" | "NET_30";
  notes: string;
  contacts: ContactDraft[];
  lineItems: LineItemDraft[];
  standaloneAddOns: AddOnDraft[];
  customLines: CustomLineDraft[];
};

const EMPTY_CONTACT: ContactDraft = { kind: "MAIN", name: "", email: "", phone: "", role: "" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuoteForm({
  products,
  clients,
  quoteId,
  initialValues,
  defaultSalesRep,
}: {
  products: ProductOption[];
  clients: ClientOption[];
  quoteId?: string;
  initialValues?: QuoteFormValues;
  defaultSalesRep?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const boothProducts = useMemo(() => products.filter((p) => p.kind === "BOOTH"), [products]);
  const addOnProducts = useMemo(() => products.filter((p) => p.kind === "ADDON"), [products]);

  const [values, setValues] = useState<QuoteFormValues>(
    initialValues ?? {
      clientId: null,
      dealDate: today(),
      salesRep: defaultSalesRep ?? "",
      market: "",
      usState: "",
      clientName: "",
      registeredAddress: "",
      assemblyAddress: "",
      socketType: "",
      targetDeliveryDate: "",
      vatNumber: "",
      clientType: "DIRECT",
      isVip: false,
      paymentTerms: "UPFRONT_100",
      notes: "",
      contacts: [{ ...EMPTY_CONTACT }],
      lineItems: [],
      standaloneAddOns: [],
      customLines: [],
    },
  );

  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const pickClient = (clientId: string) => {
    if (!clientId) {
      setValues((prev) => ({ ...prev, clientId: null }));
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    setValues((prev) => ({
      ...prev,
      clientId: client.id,
      clientName: client.name,
      registeredAddress: client.registeredAddress,
      vatNumber: client.vatNumber,
      clientType: client.clientType,
      market: client.market,
      isVip: client.isVip,
      contacts:
        client.contacts.length > 0
          ? client.contacts.map((c) => ({ ...c }))
          : [{ ...EMPTY_CONTACT }],
    }));
  };

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
    const first = boothProducts[0];
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
          addOns: [],
        },
      ],
    }));
  };

  /**
   * Add-ons offered for a given booth product: unrestricted ones plus those
   * explicitly compatible with the booth. The currently selected add-on is
   * always kept so existing quotes still render and save.
   */
  const addOnsForBooth = (boothProductId: string, currentAddOnId?: string) =>
    addOnProducts.filter(
      (p) =>
        p.restrictedToBoothIds.length === 0 ||
        p.restrictedToBoothIds.includes(boothProductId) ||
        p.id === currentAddOnId,
    );

  const newAddOnDraft = (options: ProductOption[] = addOnProducts): AddOnDraft | null => {
    const first = options[0];
    if (!first) return null;
    return { productId: first.id, quantity: 1, unitPrice: first.listPrice, description: "" };
  };

  const setAttachedAddOn = (lineIndex: number, addOnIndex: number, patch: Partial<AddOnDraft>) =>
    setValues((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) =>
        i === lineIndex
          ? {
              ...li,
              addOns: li.addOns.map((a, j) => (j === addOnIndex ? { ...a, ...patch } : a)),
            }
          : li,
      ),
    }));

  const setStandaloneAddOn = (index: number, patch: Partial<AddOnDraft>) =>
    setValues((prev) => ({
      ...prev,
      standaloneAddOns: prev.standaloneAddOns.map((a, i) =>
        i === index ? { ...a, ...patch } : a,
      ),
    }));

  const setCustomLine = (index: number, patch: Partial<CustomLineDraft>) =>
    setValues((prev) => ({
      ...prev,
      customLines: prev.customLines.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const total =
    values.lineItems.reduce(
      (sum, li) =>
        sum +
        li.quantity * li.unitPrice +
        li.addOns.reduce((s, a) => s + a.quantity * a.unitPrice, 0),
      0,
    ) +
    values.standaloneAddOns.reduce((sum, a) => sum + a.quantity * a.unitPrice, 0) +
    values.customLines.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

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

  const addOnFields = (
    addOn: AddOnDraft,
    update: (patch: Partial<AddOnDraft>) => void,
    remove: () => void,
    options: ProductOption[] = addOnProducts,
  ) => (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
      <Select
        label="Add-on"
        value={addOn.productId}
        onChange={(e) => {
          const product = options.find((p) => p.id === e.target.value);
          update({
            productId: e.target.value,
            unitPrice: product ? product.listPrice : addOn.unitPrice,
          });
        }}
      >
        {options.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name} ({product.sku})
          </option>
        ))}
      </Select>
      <Input
        label="Qty"
        type="number"
        min={1}
        value={addOn.quantity}
        onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
      />
      <Input
        label="Unit price"
        type="number"
        step="0.01"
        min={0}
        value={addOn.unitPrice}
        onChange={(e) => update({ unitPrice: Number(e.target.value) || 0 })}
      />
      <Input
        label="Description"
        value={addOn.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder="Optional"
      />
      <div className="flex items-end">
        <Button variant="ghost" onClick={remove}>
          Remove
        </Button>
      </div>
    </div>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
    >
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Deal details</h2>
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
            {/* Legacy markets outside the fixed list stay selectable. */}
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
            label="Socket type"
            value={values.socketType}
            onChange={(e) => set("socketType", e.target.value)}
          >
            <option value="">Select socket type…</option>
            {values.socketType &&
              !SOCKET_TYPE_OPTIONS.includes(values.socketType as (typeof SOCKET_TYPE_OPTIONS)[number]) && (
                <option value={values.socketType}>{values.socketType}</option>
              )}
            {SOCKET_TYPE_OPTIONS.map((socket) => (
              <option key={socket} value={socket}>
                {socket}
              </option>
            ))}
          </Select>
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
          <Input
            label="US State"
            value={values.usState}
            onChange={(e) => set("usState", e.target.value)}
            placeholder="US deals only, e.g. California"
          />
          <Input
            label="Target delivery"
            type="date"
            value={values.targetDeliveryDate}
            onChange={(e) => set("targetDeliveryDate", e.target.value)}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Assembly address"
              rows={4}
              value={values.assemblyAddress}
              onChange={(e) => set("assemblyAddress", e.target.value)}
              placeholder="Where the booths get installed"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Deal Notes"
              rows={4}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes, delivery expectations, special requests…"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Client</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Select
              label="Client"
              value={values.clientId ?? ""}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="">New client (created when the quote is saved)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.isVip ? "★ " : ""}
                  {client.name}
                  {client.market ? ` — ${client.market}` : ""}
                </option>
              ))}
            </Select>
            {values.clientId && (
              <p className="mt-1 text-xs text-slate-500">
                Fields are this quote&apos;s snapshot — edit the master record on the Clients page.
              </p>
            )}
          </div>
          <Input
            label="Client name"
            value={values.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            required
          />
          <VatNumberField
            value={values.vatNumber}
            onChange={(value) => set("vatNumber", value)}
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
          <div className="sm:col-span-2 lg:col-span-3">
            <Textarea
              label="Registered address (invoicing)"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Line items</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={addLineItem} disabled={boothProducts.length === 0}>
              Products
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const draft = newAddOnDraft();
                if (!draft) return;
                setValues((prev) => ({
                  ...prev,
                  standaloneAddOns: [...prev.standaloneAddOns, draft],
                }));
              }}
              disabled={addOnProducts.length === 0}
            >
              Add-ons
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  customLines: [
                    ...prev.customLines,
                    { name: "", quantity: 1, unitPrice: 0, description: "" },
                  ],
                }))
              }
            >
              Free text
            </Button>
          </div>
        </div>

        {boothProducts.length === 0 && (
          <p className="text-sm text-amber-700">
            No active products in the catalog. Add products first.
          </p>
        )}

        {values.lineItems.length === 0 &&
        values.standaloneAddOns.length === 0 &&
        values.customLines.length === 0 ? (
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
                      const product = boothProducts.find((p) => p.id === e.target.value);
                      setLineItem(index, {
                        productId: e.target.value,
                        unitPrice: product ? product.listPrice : item.unitPrice,
                      });
                    }}
                  >
                    {boothProducts.map((product) => (
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

                {item.addOns.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-brand-100 pl-3">
                    {item.addOns.map((addOn, addOnIndex) => (
                      <div key={addOnIndex} className="rounded-lg bg-slate-50 p-3">
                        {addOnFields(
                          addOn,
                          (patch) => setAttachedAddOn(index, addOnIndex, patch),
                          () =>
                            setValues((prev) => ({
                              ...prev,
                              lineItems: prev.lineItems.map((li, i) =>
                                i === index
                                  ? { ...li, addOns: li.addOns.filter((_, j) => j !== addOnIndex) }
                                  : li,
                              ),
                            })),
                          addOnsForBooth(item.productId, addOn.productId),
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const draft = newAddOnDraft(addOnsForBooth(item.productId));
                      if (!draft) return;
                      setLineItem(index, { addOns: [...item.addOns, draft] });
                    }}
                    disabled={addOnsForBooth(item.productId).length === 0}
                  >
                    + Attach add-on
                  </Button>
                  <p className="text-right text-sm font-medium text-slate-700">
                    {formatMoney(
                      item.quantity * item.unitPrice +
                        item.addOns.reduce((s, a) => s + a.quantity * a.unitPrice, 0),
                    )}
                  </p>
                </div>
              </div>
            ))}

            {values.standaloneAddOns.map((addOn, index) => (
              <div key={`standalone-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Standalone add-on
                </p>
                {addOnFields(
                  addOn,
                  (patch) => setStandaloneAddOn(index, patch),
                  () =>
                    setValues((prev) => ({
                      ...prev,
                      standaloneAddOns: prev.standaloneAddOns.filter((_, i) => i !== index),
                    })),
                )}
                <p className="mt-2 text-right text-sm font-medium text-slate-700">
                  {formatMoney(addOn.quantity * addOn.unitPrice)}
                </p>
              </div>
            ))}

            {values.customLines.map((custom, index) => (
              <div
                key={`custom-${index}`}
                className="rounded-lg border border-dashed border-slate-300 p-3"
              >
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Custom line
                </p>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
                  <Input
                    label="Item"
                    value={custom.name}
                    onChange={(e) => setCustomLine(index, { name: e.target.value })}
                    placeholder="e.g. Crane hire, extra shipping…"
                    required
                  />
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={custom.quantity}
                    onChange={(e) =>
                      setCustomLine(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                  <Input
                    label="Unit price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={custom.unitPrice}
                    onChange={(e) => setCustomLine(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Input
                    label="Description"
                    value={custom.description}
                    onChange={(e) => setCustomLine(index, { description: e.target.value })}
                    placeholder="Optional — shown on the quote PDF"
                  />
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setValues((prev) => ({
                          ...prev,
                          customLines: prev.customLines.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-right text-sm font-medium text-slate-700">
                  {formatMoney(custom.quantity * custom.unitPrice)}
                </p>
              </div>
            ))}

            <p className="text-right text-base font-semibold text-slate-900">
              Total: {formatMoney(total)}
            </p>
          </div>
        )}

        {addOnProducts.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            No add-on products yet — create products with the “Add-on” kind to attach extras like
            warranties or chairs.
          </p>
        )}
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : quoteId ? "Save changes" : "Create quote"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
