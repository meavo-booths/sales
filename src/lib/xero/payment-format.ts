// Prisma-free payment presentation helpers. Kept separate from sync-payment.ts
// (which imports the Prisma client) so client components can import these
// without pulling the server-only Prisma client into the browser bundle.

export type XeroInvoicePaymentState = "not_created" | "unpaid" | "partial" | "paid";

export type XeroPaymentBreakdown = {
  advance: { number: string | null; state: XeroInvoicePaymentState };
  final: { number: string | null; state: XeroInvoicePaymentState };
};

const PAYMENT_STATE_LABELS: Record<XeroInvoicePaymentState, string> = {
  not_created: "Not created yet",
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
};

export function formatPaymentBreakdownLine(
  label: string,
  number: string | null,
  state: XeroInvoicePaymentState,
): string {
  const suffix = number ? ` (${number})` : "";
  return `${label}${suffix}: ${PAYMENT_STATE_LABELS[state]}`;
}
