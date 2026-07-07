import { Fragment } from "react";
import type { Prisma } from "@prisma/client";
import {
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  FINISH_LABELS,
  PAYMENT_TERMS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import { Card } from "@/components/ui";

type DealWithRelations = Prisma.DealGetPayload<{
  include: { contacts: true; lineItems: { include: { product: true } } };
}>;

export function dealTotal(deal: DealWithRelations): number {
  return deal.lineItems.reduce((sum, li) => sum + li.quantity * Number(li.unitPrice), 0);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export function DealDetailsCard({ deal }: { deal: DealWithRelations }) {
  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Details</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Deal date" value={formatDate(deal.dealDate)} />
        <Field label="Sales rep" value={deal.salesRep} />
        <Field label="Market" value={deal.market} />
        <Field label="Socket type" value={deal.socketType} />
        <Field label="Client type" value={CLIENT_TYPE_LABELS[deal.clientType]} />
        <Field label="Payment terms" value={PAYMENT_TERMS_LABELS[deal.paymentTerms]} />
        <Field label="US State" value={deal.usState} />
        <Field label="Target delivery" value={formatDate(deal.targetDeliveryDate)} />
        <Field label="VAT number" value={deal.vatNumber} />
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Registered address (invoicing)" value={deal.registeredAddress} />
        </div>
      </dl>
    </Card>
  );
}

export function AssemblyAddressCard({ deal }: { deal: DealWithRelations }) {
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Assembly address</h2>
      <p className="whitespace-pre-wrap text-sm text-slate-700">
        {deal.assemblyAddress || "—"}
      </p>
    </Card>
  );
}

export function ContactsCard({ deal }: { deal: DealWithRelations }) {
  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Contacts</h2>
      {deal.contacts.length === 0 ? (
        <p className="text-sm text-slate-500">No contacts.</p>
      ) : (
        <ul className="space-y-3">
          {deal.contacts.map((contact) => (
            <li key={contact.id} className="rounded-lg border border-slate-200 p-3">
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
      )}
    </Card>
  );
}

function LineItemRow({
  item,
  currency,
  indent,
}: {
  item: DealWithRelations["lineItems"][number];
  currency: string;
  indent?: boolean;
}) {
  // Custom one-off lines have no product; their name lives in customName.
  const isCustom = !item.product;
  const isAddOn = item.product?.kind === "ADDON";
  return (
    <tr className="border-b border-slate-100">
      <td className={`py-2 pr-4 ${indent ? "pl-6" : ""}`}>
        <span className="font-medium text-slate-900">
          {indent ? "+ " : ""}
          {item.product?.name ?? item.customName}
        </span>
        <span className="ml-2 text-xs text-slate-500">
          {item.product ? item.product.sku : "Custom"}
        </span>
        {(item.description || item.product?.description) && (
          <p className="text-xs text-slate-500">
            {item.description || item.product?.description}
          </p>
        )}
      </td>
      <td className="py-2 pr-4">
        {isAddOn || isCustom ? (
          "—"
        ) : (
          <>
            {FINISH_LABELS[item.finish]}
            {item.finishDetails && (
              <p className="text-xs text-slate-500">{item.finishDetails}</p>
            )}
          </>
        )}
      </td>
      <td className="py-2 pr-4 text-right">{item.quantity}</td>
      <td className="py-2 pr-4 text-right">{formatMoney(Number(item.unitPrice), currency)}</td>
      <td className="py-2 text-right font-medium">
        {formatMoney(item.quantity * Number(item.unitPrice), currency)}
      </td>
    </tr>
  );
}

export function LineItemsCard({ deal }: { deal: DealWithRelations }) {
  const sorted = [...deal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const topLevel = sorted.filter((item) => !item.parentLineItemId);
  const attachedTo = (parentId: string) =>
    sorted.filter((item) => item.parentLineItemId === parentId);

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-slate-900">Line items</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Finish</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.map((item) => (
              <Fragment key={item.id}>
                <LineItemRow item={item} currency={deal.currency} />
                {attachedTo(item.id).map((addOn) => (
                  <LineItemRow key={addOn.id} item={addOn} currency={deal.currency} indent />
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-3 pr-4 text-right font-semibold text-slate-900">
                Total (excl. VAT)
              </td>
              <td className="py-3 text-right text-base font-semibold text-slate-900">
                {formatMoney(dealTotal(deal), deal.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export function NotesCard({ deal }: { deal: DealWithRelations }) {
  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold text-slate-900">Deal Notes</h2>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{deal.notes || "—"}</p>
    </Card>
  );
}
