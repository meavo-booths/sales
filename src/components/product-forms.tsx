"use client";

import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AddOnProductFamily, BoothProductFamily } from "@prisma/client";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/actions/products";
import { syncProductsFromXeroAction } from "@/app/actions/xero";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import {
  ADDON_FAMILY_LABELS,
  ADDON_FAMILY_OPTIONS,
  BOOTH_FAMILY_LABELS,
  BOOTH_FAMILY_OPTIONS,
  CLIENT_TYPE_LABELS,
  MARKET_OPTIONS,
  QUOTE_CURRENCIES,
  formatMoney,
  type QuoteCurrency,
} from "@/lib/deal-values";

const initialState: ProductActionState = {};

/** Pull the Xero item catalogue into the Product table (one-way import). */
export function SyncXeroProductsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status && (
        <p className={`text-xs ${status.ok ? "text-green-700" : "text-red-600"}`}>
          {status.text}
        </p>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setStatus(null);
          startTransition(async () => {
            const result = await syncProductsFromXeroAction();
            setStatus(
              result.ok
                ? {
                    ok: true,
                    text: `Synced: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`,
                  }
                : { ok: false, text: result.error },
            );
            router.refresh();
          });
        }}
      >
        {pending ? "Syncing…" : "Sync from Xero"}
      </Button>
    </div>
  );
}

export type ProductAvailabilityRow = {
  market: string;
  clientType: "DIRECT" | "AGENCY" | "COWORKING";
};

export type ProductRow = {
  id: string;
  name: string;
  version: string;
  kind: "BOOTH" | "ADDON";
  boothFamily: BoothProductFamily | null;
  addOnFamily: AddOnProductFamily | null;
  description: string;
  imageUrl: string | null;
  listPrice: string;
  currency: QuoteCurrency;
  isActive: boolean;
  /** For add-ons: booth families this add-on is limited to. Empty = any family. */
  restrictedBoothFamilies: BoothProductFamily[];
  availability: ProductAvailabilityRow[];
  /** Xero item code when the product is linked to a Xero item. */
  xeroItemCode: string | null;
  /** Zamp product tax code for US sales tax (Sales-owned). */
  taxCode: string;
};

function CurrencyPills({ defaultValue = "EUR" }: { defaultValue?: QuoteCurrency }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Currency</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUOTE_CURRENCIES.map((currency) => (
          <label
            key={currency}
            className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-white"
          >
            <input
              type="radio"
              name="currency"
              value={currency}
              defaultChecked={currency === defaultValue}
              className="sr-only"
            />
            <span className="px-3 py-1 text-sm font-medium">{currency}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProductFields({
  product,
  kind,
}: {
  product?: ProductRow;
  kind: "BOOTH" | "ADDON";
}) {
  const familyOptions = kind === "BOOTH" ? BOOTH_FAMILY_OPTIONS : ADDON_FAMILY_OPTIONS;
  const familyLabels = kind === "BOOTH" ? BOOTH_FAMILY_LABELS : ADDON_FAMILY_LABELS;
  const familyName = kind === "BOOTH" ? "boothFamily" : "addOnFamily";
  const currentFamily = kind === "BOOTH" ? product?.boothFamily : product?.addOnFamily;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Name" name="name" defaultValue={product?.name} required />
      <Select label="Product family" name={familyName} defaultValue={currentFamily ?? ""} required>
        <option value="">Select family…</option>
        {familyOptions.map((family) => (
          <option key={family} value={family}>
            {(familyLabels as Record<string, string>)[family]}
          </option>
        ))}
      </Select>
      <Input
        label="List price"
        name="listPrice"
        type="number"
        step="0.01"
        min="0"
        defaultValue={product?.listPrice}
      />
      <div className="flex items-end">
        <CurrencyPills defaultValue={product?.currency ?? "EUR"} />
      </div>
      <Input label="Image" name="image" type="file" accept="image/*" />
      <div className="sm:col-span-2">
        <Textarea
          label="Description"
          name="description"
          rows={2}
          defaultValue={product?.description}
        />
      </div>
      <div className="sm:col-span-2">
        <Input
          label="Zamp tax code"
          name="taxCode"
          defaultValue={product?.taxCode ?? ""}
          placeholder="e.g. R_TPP — leave blank for default tangible personal property"
        />
      </div>
    </div>
  );
}

function BoothFamilyPicker({
  defaultSelected,
}: {
  defaultSelected?: BoothProductFamily[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Available for booth families</legend>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {BOOTH_FAMILY_OPTIONS.map((family) => (
          <label key={family} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="boothFamilies"
              value={family}
              defaultChecked={defaultSelected?.includes(family)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>{BOOTH_FAMILY_LABELS[family]}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Leave all unchecked to allow this add-on on any booth family.
      </p>
    </fieldset>
  );
}

function AvailabilityPicker({ product }: { product?: ProductRow }) {
  const selectedMarkets = new Set(product?.availability.map((row) => row.market) ?? []);
  const selectedClientTypes = new Set(
    product?.availability.map((row) => row.clientType) ?? [],
  );

  return (
    <fieldset className="space-y-4">
      <div>
        <legend className="text-sm font-medium text-slate-700">Markets</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARKET_OPTIONS.map((market) => (
            <label
              key={market}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="markets"
                value={market}
                defaultChecked={selectedMarkets.has(market)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {market}
            </label>
          ))}
        </div>
      </div>
      <div>
        <legend className="text-sm font-medium text-slate-700">Client types</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.entries(CLIENT_TYPE_LABELS) as [ProductAvailabilityRow["clientType"], string][]).map(
            ([value, label]) => (
              <label
                key={value}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="clientTypes"
                  value={value}
                  defaultChecked={selectedClientTypes.has(value)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {label}
              </label>
            ),
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Leave all unchecked to make this product available in every market and client type.
      </p>
    </fieldset>
  );
}

function familyLabel(product: ProductRow): string {
  if (product.kind === "BOOTH" && product.boothFamily) {
    return BOOTH_FAMILY_LABELS[product.boothFamily];
  }
  if (product.kind === "ADDON" && product.addOnFamily) {
    return ADDON_FAMILY_LABELS[product.addOnFamily];
  }
  return "—";
}

export function BoothCreateForm({
  onCreated,
  inModal = false,
}: {
  onCreated?: () => void;
  inModal?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
    onCreated?.();
  }, [state.success, onCreated, router]);

  return (
    <form action={formAction} className={inModal ? "space-y-4" : "mt-4 space-y-4"}>
      <input type="hidden" name="kind" value="BOOTH" />
      <ProductFields kind="BOOTH" />
      <AvailabilityPicker />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Booth created.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create booth"}
      </Button>
    </form>
  );
}

export function AddOnCreateForm({
  onCreated,
  inModal = false,
}: {
  onCreated?: () => void;
  inModal?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
    onCreated?.();
  }, [state.success, onCreated, router]);

  return (
    <form action={formAction} className={inModal ? "space-y-4" : "mt-4 space-y-4"}>
      <input type="hidden" name="kind" value="ADDON" />
      <ProductFields kind="ADDON" />
      <AvailabilityPicker />
      <BoothFamilyPicker />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Add-on created.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create add-on"}
      </Button>
    </form>
  );
}

export function ProductListItem({ product }: { product: ProductRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateProductAction, initialState);

  const isAddOn = product.kind === "ADDON";

  return (
    <Card>
      <div className="flex items-start gap-4">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            No image
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{product.name}</span>
            {product.version && (
              <span className="text-xs text-slate-500">{product.version}</span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {familyLabel(product)}
            </span>
            {!product.isActive && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Inactive
              </span>
            )}
            {product.xeroItemCode && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                Xero: {product.xeroItemCode}
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-1 text-sm text-slate-600">{product.description}</p>
          )}
          <p className="mt-1 text-sm font-medium text-slate-900">
            {formatMoney(product.listPrice, product.currency)}
          </p>
          {isAddOn && (
            <p className="mt-1 text-xs text-slate-500">
              {product.restrictedBoothFamilies.length === 0
                ? "Available for any booth family"
                : `Available for: ${product.restrictedBoothFamilies
                    .map((family) => BOOTH_FAMILY_LABELS[family])
                    .join(", ")}`}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {product.availability.length === 0
              ? "Available in all markets and client types"
              : `Markets / client types: ${[
                  ...new Set(
                    product.availability.map(
                      (row) => `${row.market} (${CLIENT_TYPE_LABELS[row.clientType]})`,
                    ),
                  ),
                ].join(", ")}`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <form action={formAction} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={product.id} />
          {isAddOn ? (
            <input type="hidden" name="kind" value="ADDON" />
          ) : (
            <Select label="Type" name="kind" defaultValue={product.kind} className="sm:max-w-xs">
              <option value="BOOTH">Booth</option>
              <option value="ADDON">Add-on</option>
            </Select>
          )}
          <ProductFields product={product} kind={product.kind} />
          <AvailabilityPicker product={product} />
          {isAddOn && (
            <BoothFamilyPicker defaultSelected={product.restrictedBoothFamilies} />
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product.isActive}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active (available on new quotes)
          </label>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && <p className="text-sm text-green-700">Saved.</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      )}
    </Card>
  );
}
