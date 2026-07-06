"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/actions/products";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

const initialState: ProductActionState = {};

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  kind: "BOOTH" | "ADDON";
  description: string;
  imageUrl: string | null;
  listPrice: string;
  isActive: boolean;
  /** For add-ons: booth product ids this add-on is limited to. Empty = any booth. */
  restrictedBoothIds: string[];
};

export type BoothOption = {
  id: string;
  name: string;
  sku: string;
};

function ProductFields({ product }: { product?: ProductRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Name (model)" name="name" defaultValue={product?.name} required />
      <Input label="SKU" name="sku" defaultValue={product?.sku} required />
      <Input
        label="List price (EUR)"
        name="listPrice"
        type="number"
        step="0.01"
        min="0"
        defaultValue={product?.listPrice}
      />
      <Input label="Image" name="image" type="file" accept="image/*" />
      <div className="sm:col-span-2">
        <Textarea
          label="Description"
          name="description"
          rows={2}
          defaultValue={product?.description}
        />
      </div>
    </div>
  );
}

function BoothPicker({
  booths,
  defaultSelected,
}: {
  booths: BoothOption[];
  defaultSelected?: string[];
}) {
  if (booths.length === 0) return null;
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Available for</legend>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {booths.map((booth) => (
          <label key={booth.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="boothIds"
              value={booth.id}
              defaultChecked={defaultSelected?.includes(booth.id)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="min-w-0 truncate">
              {booth.name} <span className="text-xs text-slate-500">{booth.sku}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Leave all unchecked to allow this add-on on any booth.
      </p>
    </fieldset>
  );
}

export function BoothCreateForm() {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="kind" value="BOOTH" />
      <ProductFields />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Booth created.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create booth"}
      </Button>
    </form>
  );
}

export function AddOnCreateForm({ booths }: { booths: BoothOption[] }) {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="kind" value="ADDON" />
      <ProductFields />
      <BoothPicker booths={booths} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Add-on created.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create add-on"}
      </Button>
    </form>
  );
}

export function ProductListItem({
  product,
  booths,
}: {
  product: ProductRow;
  booths: BoothOption[];
}) {
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
            <span className="text-xs text-slate-500">{product.sku}</span>
            {!product.isActive && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Inactive
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-1 text-sm text-slate-600">{product.description}</p>
          )}
          <p className="mt-1 text-sm font-medium text-slate-900">
            €{Number(product.listPrice).toFixed(2)}
          </p>
          {isAddOn && (
            <p className="mt-1 text-xs text-slate-500">
              {product.restrictedBoothIds.length === 0
                ? "Available for any booth"
                : `Available for: ${product.restrictedBoothIds
                    .map((id) => booths.find((b) => b.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}`}
            </p>
          )}
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
          <ProductFields product={product} />
          {isAddOn && (
            <BoothPicker booths={booths} defaultSelected={product.restrictedBoothIds} />
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
