"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/actions/products";
import { Button, Card, Input, Textarea } from "@/components/ui";

const initialState: ProductActionState = {};

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  description: string;
  imageUrl: string | null;
  listPrice: string;
  isActive: boolean;
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

export function ProductCreateForm() {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Add product</h2>
      <form action={formAction} className="space-y-4">
        <ProductFields />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add product"}
        </Button>
      </form>
    </Card>
  );
}

export function ProductListItem({ product }: { product: ProductRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateProductAction, initialState);

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
        </div>
        <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Edit"}
        </Button>
      </div>

      {editing && (
        <form action={formAction} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={product.id} />
          <ProductFields product={product} />
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
