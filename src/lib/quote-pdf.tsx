import path from "path";
// Explicit import so the module also works under classic JSX runtimes (tsx scripts).
import React from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import {
  CLIENT_TYPE_LABELS,
  CONTACT_KIND_LABELS,
  FINISH_LABELS,
  PAYMENT_TERMS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/deal-values";
import { dealSubtotal, dealTotals, formatTaxLineLabel } from "@/lib/vat";
import { persistedUsTaxAmount } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";

type QuoteForPdf = Prisma.DealGetPayload<{
  include: { contacts: true; lineItems: { include: { product: true } } };
}>;

const BRAND = "#0C8F61";
const SLATE = "#334155";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: SLATE,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  logo: { width: 90, objectFit: "contain" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND },
  meta: { marginTop: 4, color: MUTED },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  columns: { flexDirection: "row", gap: 24, marginBottom: 24 },
  column: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  line: { marginBottom: 2 },
  table: { borderTopWidth: 1, borderColor: BORDER },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    alignItems: "center",
  },
  headRow: { backgroundColor: "#f8fafc" },
  cellProduct: { flex: 4, paddingRight: 8 },
  cellFinish: { flex: 2.5, paddingRight: 8 },
  cellQty: { flex: 0.8, textAlign: "right", paddingRight: 8 },
  cellPrice: { flex: 1.5, textAlign: "right", paddingRight: 8 },
  cellAmount: { flex: 1.5, textAlign: "right" },
  productImage: { width: 32, height: 32, objectFit: "cover", borderRadius: 4, marginRight: 8 },
  addOnIndent: { paddingLeft: 16 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 8,
    gap: 24,
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: BRAND },
  subtotalLabel: { fontSize: 10, color: SLATE },
  subtotalValue: { fontSize: 10, color: SLATE },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 30,
    borderTopWidth: 1,
    borderColor: BORDER,
    paddingTop: 8,
    color: MUTED,
    fontSize: 8,
    textAlign: "center",
  },
});

type LineItemForPdf = QuoteForPdf["lineItems"][number];

function LineItemRow({
  item,
  currency,
  indent,
}: {
  item: LineItemForPdf;
  currency: string;
  indent?: boolean;
}) {
  // Custom one-off lines have no product; their name lives in customName.
  const isCustom = !item.product;
  const isAddOn = item.product?.kind === "ADDON";
  return (
    <View style={styles.row} wrap={false}>
      <View
        style={[
          styles.cellProduct,
          { flexDirection: "row", alignItems: "center" },
          ...(indent ? [styles.addOnIndent] : []),
        ]}
      >
        {item.product?.imageUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
          <Image src={item.product.imageUrl} style={styles.productImage} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.bold}>
            {indent ? "+ " : ""}
            {item.product?.name ?? item.customName}
          </Text>
          <Text style={{ color: MUTED }}>
            {item.description || item.product?.description || item.product?.version || ""}
          </Text>
        </View>
      </View>
      <View style={styles.cellFinish}>
        {isAddOn || isCustom ? (
          <Text> </Text>
        ) : (
          <>
            <Text>{FINISH_LABELS[item.finish]}</Text>
            {item.finishDetails ? (
              <Text style={{ color: MUTED }}>{item.finishDetails}</Text>
            ) : null}
          </>
        )}
      </View>
      <Text style={styles.cellQty}>{item.quantity}</Text>
      <Text style={styles.cellPrice}>{formatMoney(Number(item.unitPrice), currency)}</Text>
      <Text style={styles.cellAmount}>
        {formatMoney(item.quantity * Number(item.unitPrice), currency)}
      </Text>
    </View>
  );
}

export function QuotePdfDocument({ quote }: { quote: QuoteForPdf }) {
  const logoPath = path.join(process.cwd(), "public", "meavo-logo.png");
  const totals = dealTotals(dealSubtotal(quote), quote.market, {
    salesTaxAmount: persistedUsTaxAmount(quote),
  });
  const taxLabel = formatTaxLineLabel(quote.market, totals.vatRate);
  const mainContacts = quote.contacts.filter((c) => c.kind === "MAIN");

  // Attached add-ons render indented under their booth; everything else is a top-level row.
  const topLevelItems = quote.lineItems.filter((item) => !item.parentLineItemId);
  const attachedAddOns = (parentId: string) =>
    quote.lineItems.filter((item) => item.parentLineItemId === parentId);

  return (
    <Document title={`${quote.quoteNumber} — MEAVO quote`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={logoPath} style={styles.logo} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>Quote {quote.quoteNumber}</Text>
            <Text style={styles.meta}>Date: {formatDate(quote.dealDate)}</Text>
            {quote.salesRep ? <Text style={styles.meta}>Sales rep: {quote.salesRep}</Text> : null}
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={[styles.bold, styles.line]}>{quote.clientName}</Text>
            {quote.registeredAddress ? (
              <Text style={styles.line}>{quote.registeredAddress}</Text>
            ) : null}
            {quote.vatNumber ? <Text style={styles.line}>VAT: {quote.vatNumber}</Text> : null}
            <Text style={styles.line}>
              Client type: {CLIENT_TYPE_LABELS[quote.clientType]}
            </Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Contacts</Text>
            {(mainContacts.length > 0 ? mainContacts : quote.contacts).map((contact) => (
              <View key={contact.id} style={{ marginBottom: 4 }}>
                <Text style={styles.bold}>
                  {contact.name}
                  {contact.role ? ` — ${contact.role}` : ""}
                </Text>
                <Text style={{ color: MUTED }}>
                  {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                    CONTACT_KIND_LABELS[contact.kind]}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <Text style={styles.line}>
              Payment terms: {PAYMENT_TERMS_LABELS[quote.paymentTerms]}
            </Text>
            <Text style={styles.line}>Currency: {quote.currency}</Text>
            <Text style={styles.line}>
              {totals.hasTax
                ? isUsMarket(quote.market)
                  ? "Line prices exclude sales tax. US sales tax is added to the total."
                  : `Line prices exclude VAT. ${formatTaxLineLabel(quote.market, totals.vatRate)} is added to the total.`
                : isUsMarket(quote.market)
                  ? "Line prices exclude sales tax."
                  : "Prices exclude VAT."}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cellProduct, styles.bold]}>Product</Text>
            <Text style={[styles.cellFinish, styles.bold]}>Finish</Text>
            <Text style={[styles.cellQty, styles.bold]}>Qty</Text>
            <Text style={[styles.cellPrice, styles.bold]}>Unit price</Text>
            <Text style={[styles.cellAmount, styles.bold]}>Amount</Text>
          </View>
          {topLevelItems.map((item) => (
            <React.Fragment key={item.id}>
              <LineItemRow item={item} currency={quote.currency} />
              {attachedAddOns(item.id).map((addOn) => (
                <LineItemRow key={addOn.id} item={addOn} currency={quote.currency} indent />
              ))}
            </React.Fragment>
          ))}
          {totals.hasTax ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.subtotalLabel}>
                  Subtotal (excl. {totals.taxLabel.toLowerCase()})
                </Text>
                <Text style={styles.subtotalValue}>
                  {formatMoney(totals.subtotal, quote.currency)}
                </Text>
              </View>
              <View style={[styles.totalRow, { paddingVertical: 2 }]}>
                <Text style={styles.subtotalLabel}>{taxLabel}</Text>
                <Text style={styles.subtotalValue}>
                  {formatMoney(totals.vatAmount, quote.currency)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Total (incl. {totals.taxLabel.toLowerCase()})
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoney(totals.totalInclVat, quote.currency)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {isUsMarket(quote.market) ? "Total (excl. sales tax)" : "Total (excl. VAT)"}
              </Text>
              <Text style={styles.totalValue}>{formatMoney(totals.subtotal, quote.currency)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          MEAVO — office phone booths · meavo.com · This quote is valid for 30 days from the date
          above.
        </Text>
      </Page>
    </Document>
  );
}
