import type { PaymentStatus } from "@prisma/client";
import { Badge, Card, VipBadge } from "@/components/ui";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_TERMS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";

const PAYMENT_TONES: Record<PaymentStatus, "red" | "amber" | "green"> = {
  UNPAID: "red",
  PARTIALLY_PAID: "amber",
  PAID: "green",
};

export type DealSummaryProps = {
  dealId: string;
  quoteNumber: string;
  clientName: string;
  isVip: boolean;
  currency: string;
  totalInclTax: number;
  taxLabel: string;
  paymentStatus: PaymentStatus;
  wonAt: Date | null;
  targetDeliveryDate: Date | null;
  paymentPoDate: Date | null;
  market: string;
  paymentTerms: keyof typeof PAYMENT_TERMS_LABELS;
};

export function DealSummaryBar({
  dealId,
  quoteNumber,
  clientName,
  isVip,
  currency,
  totalInclTax,
  taxLabel,
  paymentStatus,
  wonAt,
  targetDeliveryDate,
  paymentPoDate,
  market,
  paymentTerms,
}: DealSummaryProps) {
  return (
    <Card className="mb-4">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-slate-900">{clientName}</p>
            {isVip && <VipBadge />}
            <Badge tone={PAYMENT_TONES[paymentStatus]}>
              {PAYMENT_STATUS_LABELS[paymentStatus]}
            </Badge>
          </div>
          <p className="font-mono text-xs text-slate-500">
            {dealId} · {quoteNumber}
          </p>
        </div>

        <div className="text-center lg:px-6">
          <p className="text-3xl font-semibold tabular-nums text-slate-900">
            {formatMoney(totalInclTax, currency)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Total incl. {taxLabel.toLowerCase()}</p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 lg:text-right xl:grid-cols-2 xl:text-left">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Won</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{formatDate(wonAt) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Target delivery
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {formatDate(targetDeliveryDate) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment / PO date
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {formatDate(paymentPoDate) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Market</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{market || "—"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment terms
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {PAYMENT_TERMS_LABELS[paymentTerms]}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

type LifecycleStep = {
  id: string;
  label: string;
  done: boolean;
  warning?: boolean;
  href?: string;
};

export type DealLifecycleProps = {
  sheetSyncedAt: Date | null;
  sheetSyncError: string | null;
  xeroInvoiceId: string | null;
  xeroSyncError: string | null;
  xeroFinalInvoiceId: string | null;
  xeroFinalSyncError: string | null;
  paymentTerms: keyof typeof PAYMENT_TERMS_LABELS;
  showZamp: boolean;
  zampSyncedAt: Date | null;
  zampSyncError: string | null;
  paymentStatus: PaymentStatus;
  readyToAssemble: boolean;
};

function LifecyclePill({ step }: { step: LifecycleStep }) {
  const tone = step.warning
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : step.done
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-slate-200 bg-slate-50 text-slate-600";

  const content = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          step.warning ? "bg-amber-500" : step.done ? "bg-green-600" : "bg-slate-300"
        }`}
        aria-hidden
      />
      {step.label}
    </span>
  );

  if (step.href) {
    return (
      <a href={step.href} className="transition hover:opacity-80">
        {content}
      </a>
    );
  }
  return content;
}

export function DealLifecycleStrip(props: DealLifecycleProps) {
  const showFinalInvoice = props.paymentTerms === "SPLIT_50_50";

  const steps: LifecycleStep[] = [
    { id: "won", label: "Won", done: true },
    {
      id: "ops",
      label: props.sheetSyncedAt ? "Ops File synced" : "Ops File",
      done: Boolean(props.sheetSyncedAt),
      warning: Boolean(props.sheetSyncError),
      href: props.sheetSyncError ? "#deal-sync-alerts" : undefined,
    },
    {
      id: "xero",
      label: props.xeroInvoiceId
        ? props.paymentTerms === "SPLIT_50_50"
          ? "Xero advance invoice"
          : "Xero invoice"
        : "Xero invoice",
      done: Boolean(props.xeroInvoiceId),
      warning: Boolean(props.xeroSyncError),
      href: props.xeroSyncError ? "#deal-sync-alerts" : undefined,
    },
    ...(showFinalInvoice
      ? [
          {
            id: "xero-final",
            label: props.xeroFinalInvoiceId ? "Xero final invoice" : "Xero final invoice",
            done: Boolean(props.xeroFinalInvoiceId),
            warning: Boolean(props.xeroFinalSyncError),
            href: props.xeroFinalSyncError ? "#deal-sync-alerts" : undefined,
          } satisfies LifecycleStep,
        ]
      : []),
    ...(props.showZamp
      ? [
          {
            id: "zamp",
            label: props.zampSyncedAt ? "Zamp synced" : "Zamp",
            done: Boolean(props.zampSyncedAt),
            warning: Boolean(props.zampSyncError),
            href: props.zampSyncError ? "#deal-sync-alerts" : undefined,
          } satisfies LifecycleStep,
        ]
      : []),
    {
      id: "paid",
      label: "Paid",
      done: props.paymentStatus === "PAID",
      warning: props.paymentStatus === "PARTIALLY_PAID",
    },
    {
      id: "ready",
      label: "Ready to assemble",
      done: props.readyToAssemble,
    },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {steps.map((step) => (
        <LifecyclePill key={step.id} step={step} />
      ))}
    </div>
  );
}
