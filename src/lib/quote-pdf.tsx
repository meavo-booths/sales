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
  lineItemEffectiveUnitPrice,
  lineItemExtendedTotal,
  parseDiscountType,
  parseDiscountValue,
} from "@/lib/line-item-pricing";
import { dealSubtotal, dealTotals } from "@/lib/vat";
import { persistedUsTaxAmount } from "@/lib/zamp/calculate-tax";
import { isUsMarket } from "@/lib/zamp/constants";
import {
  formatDateForPdf,
  formatDiscountLabelForPdf,
  formatMoneyForPdf,
  formatTaxLineLabelForPdf,
  quotePdfMessages,
  taxLabelForMarketForPdf,
  type QuotePdfLang,
  type QuotePdfMessages,
} from "@/lib/quote-pdf-messages";

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
  cellProduct: { flex: 3.5, paddingRight: 8 },
  cellFinish: { flex: 2, paddingRight: 8 },
  cellQty: { flex: 0.7, textAlign: "right", paddingRight: 8 },
  cellPrice: { flex: 1.4, textAlign: "right", paddingRight: 8 },
  cellAfterDiscount: { flex: 1.4, textAlign: "right", paddingRight: 8 },
  cellAmount: { flex: 1.4, textAlign: "right" },
  productImage: { width: 32, height: 32, objectFit: "cover", borderRadius: 4, marginRight: 8 },
  // Fixed-width spacer inside the product cell — do not put paddingLeft on the
  // flex cell itself (Yoga treats that as extra outer width and shifts later columns).
  addOnIndentSpacer: { width: 16, flexShrink: 0 },
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
  hasDiscount,
  lang,
  t,
}: {
  item: LineItemForPdf;
  currency: string;
  indent?: boolean;
  hasDiscount: boolean;
  lang: QuotePdfLang;
  t: QuotePdfMessages;
}) {
  // Custom one-off lines have no product; their name lives in customName.
  const isCustom = !item.product;
  const isAddOn = item.product?.kind === "ADDON";
  const discountType = parseDiscountType(item.discountType);
  const discountValue = parseDiscountValue(item.discountValue);
  const discountLabel = formatDiscountLabelForPdf(
    discountType,
    discountValue,
    currency,
    lang,
  );
  const lineTotal = lineItemExtendedTotal(item);
  const afterDiscount = lineItemEffectiveUnitPrice(item);
  const isZeroQty = item.quantity === 0;
  return (
    <View style={styles.row} wrap={false}>
      <View
        style={[
          styles.cellProduct,
          { flexDirection: "row", alignItems: "center" },
        ]}
      >
        {indent ? <View style={styles.addOnIndentSpacer} /> : null}
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
            <Text>{t.finishLabels[item.finish]}</Text>
            {item.finishDetails ? (
              <Text style={{ color: MUTED }}>{item.finishDetails}</Text>
            ) : null}
          </>
        )}
      </View>
      <Text style={styles.cellQty}>{isZeroQty ? " " : item.quantity}</Text>
      <View style={styles.cellPrice}>
        {isZeroQty ? (
          <Text> </Text>
        ) : (
          <>
            <Text>{formatMoneyForPdf(Number(item.unitPrice), currency, lang)}</Text>
            {discountLabel ? <Text style={{ color: MUTED }}>{discountLabel}</Text> : null}
          </>
        )}
      </View>
      {hasDiscount ? (
        <Text style={styles.cellAfterDiscount}>
          {formatMoneyForPdf(afterDiscount, currency, lang)}
        </Text>
      ) : null}
      <Text style={styles.cellAmount}>{formatMoneyForPdf(lineTotal, currency, lang)}</Text>
    </View>
  );
}

export function QuotePdfDocument({
  quote,
  lang = "en",
}: {
  quote: QuoteForPdf;
  lang?: QuotePdfLang;
}) {
  const t = quotePdfMessages(lang);
  const logoPath = path.join(process.cwd(), "public", "meavo-logo.png");
  const totals = dealTotals(dealSubtotal(quote), quote.market, {
    salesTaxAmount: persistedUsTaxAmount(quote),
  });
  const taxLabel = formatTaxLineLabelForPdf(quote.market, totals.vatRate, lang);
  const taxLabelBase = taxLabelForMarketForPdf(quote.market, lang);
  const mainContacts = quote.contacts.filter((c) => c.kind === "MAIN");
  const hasDiscount = quote.lineItems.some(
    (item) =>
      parseDiscountType(item.discountType) !== "NONE" &&
      parseDiscountValue(item.discountValue) > 0,
  );

  // Attached add-ons render indented under their booth; everything else is a top-level row.
  const topLevelItems = quote.lineItems.filter((item) => !item.parentLineItemId);
  const attachedAddOns = (parentId: string) =>
    quote.lineItems.filter((item) => item.parentLineItemId === parentId);

  return (
    <Document title={t.documentTitle(quote.quoteNumber)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          <Image src={logoPath} style={styles.logo} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>{t.quoteTitle(quote.quoteNumber)}</Text>
            <Text style={styles.meta}>
              {t.date} {formatDateForPdf(quote.dealDate, lang)}
            </Text>
            {quote.salesRep ? (
              <Text style={styles.meta}>
                {t.preparedBy} {quote.salesRep}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.client}</Text>
            <Text style={[styles.bold, styles.line]}>{quote.clientName}</Text>
            {quote.registeredAddress ? (
              <Text style={styles.line}>{quote.registeredAddress}</Text>
            ) : null}
            {quote.vatNumber ? (
              <Text style={styles.line}>
                {t.vatPrefix} {quote.vatNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.contacts}</Text>
            {mainContacts.map((contact) => (
              <View key={contact.id} style={{ marginBottom: 4 }}>
                <Text style={styles.bold}>{contact.name}</Text>
                {contact.email ? (
                  <Text style={{ color: MUTED }}>{contact.email}</Text>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.terms}</Text>
            <Text style={styles.line}>
              {t.paymentTerms} {t.paymentTermsLabels[quote.paymentTerms]}
            </Text>
            <Text style={styles.line}>
              {t.currency} {quote.currency}
            </Text>
            <Text style={styles.line}>
              {totals.hasTax
                ? isUsMarket(quote.market)
                  ? t.taxNoteWithTaxUs
                  : t.taxNoteWithTaxEu(taxLabel)
                : isUsMarket(quote.market)
                  ? t.taxNoteNoTaxUs
                  : t.taxNoteNoTaxEu}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cellProduct, styles.bold]}>{t.product}</Text>
            <Text style={[styles.cellFinish, styles.bold]}>{t.finish}</Text>
            <Text style={[styles.cellQty, styles.bold]}>{t.qty}</Text>
            <Text style={[styles.cellPrice, styles.bold]}>{t.unitPrice}</Text>
            {hasDiscount ? (
              <Text style={[styles.cellAfterDiscount, styles.bold]}>{t.afterDiscount}</Text>
            ) : null}
            <Text style={[styles.cellAmount, styles.bold]}>{t.amount}</Text>
          </View>
          {topLevelItems.map((item) => (
            <React.Fragment key={item.id}>
              <LineItemRow
                item={item}
                currency={quote.currency}
                hasDiscount={hasDiscount}
                lang={lang}
                t={t}
              />
              {attachedAddOns(item.id).map((addOn) => (
                <LineItemRow
                  key={addOn.id}
                  item={addOn}
                  currency={quote.currency}
                  indent
                  hasDiscount={hasDiscount}
                  lang={lang}
                  t={t}
                />
              ))}
            </React.Fragment>
          ))}
          {totals.hasTax ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.subtotalLabel}>
                  {t.subtotalExcl(taxLabelBase)}
                </Text>
                <Text style={styles.subtotalValue}>
                  {formatMoneyForPdf(totals.subtotal, quote.currency, lang)}
                </Text>
              </View>
              <View style={[styles.totalRow, { paddingVertical: 2 }]}>
                <Text style={styles.subtotalLabel}>{taxLabel}</Text>
                <Text style={styles.subtotalValue}>
                  {formatMoneyForPdf(totals.vatAmount, quote.currency, lang)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {t.totalIncl(taxLabelBase)}
                </Text>
                <Text style={styles.totalValue}>
                  {formatMoneyForPdf(totals.totalInclVat, quote.currency, lang)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {isUsMarket(quote.market) ? t.totalExclSalesTax : t.totalExclVat}
              </Text>
              <Text style={styles.totalValue}>
                {formatMoneyForPdf(totals.subtotal, quote.currency, lang)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {t.footer}
        </Text>
      </Page>
    </Document>
  );
}
