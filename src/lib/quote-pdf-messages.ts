/**
 * PDF-only i18n for quote downloads. The Sales UI stays English;
 * product/line names are never translated here.
 */
import type { PaymentTerms, ProductFinish } from "@prisma/client";
import type { LineItemDiscountType } from "@/lib/line-item-pricing";

export const QUOTE_PDF_LANGS = ["en", "es", "it", "de", "fr"] as const;
export type QuotePdfLang = (typeof QUOTE_PDF_LANGS)[number];

export const QUOTE_PDF_LANG_LABELS: Record<QuotePdfLang, string> = {
  en: "English",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
};

const MARKET_DEFAULT_LANG: Record<string, QuotePdfLang> = {
  Spain: "es",
  Italy: "it",
  Germany: "de",
  France: "fr",
};

const LANG_LOCALES: Record<QuotePdfLang, string> = {
  en: "en-GB",
  es: "es-ES",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
};

export function isQuotePdfLang(value: string): value is QuotePdfLang {
  return (QUOTE_PDF_LANGS as readonly string[]).includes(value);
}

export function parseQuotePdfLang(value: string | null | undefined): QuotePdfLang {
  if (value && isQuotePdfLang(value)) return value;
  return "en";
}

export function defaultQuotePdfLang(market: string): QuotePdfLang {
  return MARKET_DEFAULT_LANG[market] ?? "en";
}

export type QuotePdfMessages = {
  documentTitle: (quoteNumber: string) => string;
  quoteTitle: (quoteNumber: string) => string;
  date: string;
  preparedBy: string;
  client: string;
  vatPrefix: string;
  contacts: string;
  terms: string;
  paymentTerms: string;
  currency: string;
  taxNoteWithTaxEu: (taxLabel: string) => string;
  taxNoteWithTaxUs: string;
  taxNoteNoTaxEu: string;
  taxNoteNoTaxUs: string;
  product: string;
  finish: string;
  qty: string;
  unitPrice: string;
  afterDiscount: string;
  amount: string;
  subtotalExcl: (taxLabelLower: string) => string;
  totalIncl: (taxLabelLower: string) => string;
  totalExclVat: string;
  totalExclSalesTax: string;
  footer: string;
  taxLabelVat: string;
  taxLabelSalesTax: string;
  paymentTermsLabels: Record<PaymentTerms, string>;
  finishLabels: Record<ProductFinish, string>;
  percentOff: (n: number) => string;
  fixedOffUnit: (money: string) => string;
};

const PAYMENT_EN: Record<PaymentTerms, string> = {
  UPFRONT_100: "100% upfront",
  SPLIT_50_50: "50% / 50%",
  NET_7: "Net 7",
  NET_30: "Net 7",
};

const FINISH_EN: Record<ProductFinish, string> = {
  CUSTOM: "Custom",
  WHITE_STOCK: "White Stock",
  BLACK_STOCK: "Black Stock",
  LDF_COLOUR: "LDF Colour",
};

const MESSAGES: Record<QuotePdfLang, QuotePdfMessages> = {
  en: {
    documentTitle: (n) => `${n} — MEAVO quote`,
    quoteTitle: (n) => `Quote ${n}`,
    date: "Date:",
    preparedBy: "Prepared by:",
    client: "Client",
    vatPrefix: "VAT:",
    contacts: "Contacts",
    terms: "Terms",
    paymentTerms: "Payment terms:",
    currency: "Currency:",
    taxNoteWithTaxEu: (taxLabel) =>
      `Line prices exclude VAT. ${taxLabel} is added to the total.`,
    taxNoteWithTaxUs: "Line prices exclude sales tax. US sales tax is added to the total.",
    taxNoteNoTaxEu: "Prices exclude VAT.",
    taxNoteNoTaxUs: "Line prices exclude sales tax.",
    product: "Product",
    finish: "Finish",
    qty: "Qty",
    unitPrice: "Unit price",
    afterDiscount: "After discount",
    amount: "Amount",
    subtotalExcl: (tax) => `Subtotal (excl. ${tax})`,
    totalIncl: (tax) => `Total (incl. ${tax})`,
    totalExclVat: "Total (excl. VAT)",
    totalExclSalesTax: "Total (excl. sales tax)",
    footer:
      "MEAVO — office phone booths · meavo.com · This quote is valid for 30 days from the date above.",
    taxLabelVat: "VAT",
    taxLabelSalesTax: "Sales tax",
    paymentTermsLabels: PAYMENT_EN,
    finishLabels: FINISH_EN,
    percentOff: (n) => `${n}% off`,
    fixedOffUnit: (money) => `${money} off/unit`,
  },
  es: {
    documentTitle: (n) => `${n} — Presupuesto MEAVO`,
    quoteTitle: (n) => `Presupuesto ${n}`,
    date: "Fecha:",
    preparedBy: "Preparado por:",
    client: "Cliente",
    vatPrefix: "NIF/IVA:",
    contacts: "Contactos",
    terms: "Condiciones",
    paymentTerms: "Condiciones de pago:",
    currency: "Moneda:",
    taxNoteWithTaxEu: (taxLabel) =>
      `Los precios de línea no incluyen IVA. Se añade ${taxLabel} al total.`,
    taxNoteWithTaxUs:
      "Los precios de línea no incluyen el impuesto sobre las ventas. El impuesto sobre las ventas de EE. UU. se añade al total.",
    taxNoteNoTaxEu: "Los precios no incluyen IVA.",
    taxNoteNoTaxUs: "Los precios de línea no incluyen el impuesto sobre las ventas.",
    product: "Producto",
    finish: "Acabado",
    qty: "Cant.",
    unitPrice: "Precio unitario",
    afterDiscount: "Tras descuento",
    amount: "Importe",
    subtotalExcl: (tax) => `Subtotal (sin ${tax})`,
    totalIncl: (tax) => `Total (con ${tax})`,
    totalExclVat: "Total (sin IVA)",
    totalExclSalesTax: "Total (sin impuesto sobre las ventas)",
    footer:
      "MEAVO — cabinas telefónicas de oficina · meavo.com · Este presupuesto es válido durante 30 días a partir de la fecha indicada.",
    taxLabelVat: "IVA",
    taxLabelSalesTax: "Impuesto sobre las ventas",
    paymentTermsLabels: {
      UPFRONT_100: "100% por adelantado",
      SPLIT_50_50: "50% / 50%",
      NET_7: "Neto 7",
      NET_30: "Neto 7",
    },
    finishLabels: {
      CUSTOM: "Personalizado",
      WHITE_STOCK: "Stock blanco",
      BLACK_STOCK: "Stock negro",
      LDF_COLOUR: "Color LDF",
    },
    percentOff: (n) => `${n}% de descuento`,
    fixedOffUnit: (money) => `${money} de dto./ud.`,
  },
  it: {
    documentTitle: (n) => `${n} — Preventivo MEAVO`,
    quoteTitle: (n) => `Preventivo ${n}`,
    date: "Data:",
    preparedBy: "Preparato da:",
    client: "Cliente",
    vatPrefix: "P. IVA:",
    contacts: "Contatti",
    terms: "Condizioni",
    paymentTerms: "Condizioni di pagamento:",
    currency: "Valuta:",
    taxNoteWithTaxEu: (taxLabel) =>
      `I prezzi di riga sono IVA esclusa. ${taxLabel} viene aggiunto al totale.`,
    taxNoteWithTaxUs:
      "I prezzi di riga escludono l'imposta sulle vendite. L'imposta sulle vendite USA viene aggiunta al totale.",
    taxNoteNoTaxEu: "I prezzi sono IVA esclusa.",
    taxNoteNoTaxUs: "I prezzi di riga escludono l'imposta sulle vendite.",
    product: "Prodotto",
    finish: "Finitura",
    qty: "Qtà",
    unitPrice: "Prezzo unitario",
    afterDiscount: "Dopo sconto",
    amount: "Importo",
    subtotalExcl: (tax) => `Subtotale (escl. ${tax})`,
    totalIncl: (tax) => `Totale (incl. ${tax})`,
    totalExclVat: "Totale (escl. IVA)",
    totalExclSalesTax: "Totale (escl. imposta sulle vendite)",
    footer:
      "MEAVO — cabine telefoniche per ufficio · meavo.com · Questo preventivo è valido per 30 giorni dalla data sopra indicata.",
    taxLabelVat: "IVA",
    taxLabelSalesTax: "Imposta sulle vendite",
    paymentTermsLabels: {
      UPFRONT_100: "100% anticipato",
      SPLIT_50_50: "50% / 50%",
      NET_7: "Netto 7",
      NET_30: "Netto 7",
    },
    finishLabels: {
      CUSTOM: "Personalizzato",
      WHITE_STOCK: "Stock bianco",
      BLACK_STOCK: "Stock nero",
      LDF_COLOUR: "Colore LDF",
    },
    percentOff: (n) => `${n}% di sconto`,
    fixedOffUnit: (money) => `${money} di sconto/ud.`,
  },
  de: {
    documentTitle: (n) => `${n} — MEAVO Angebot`,
    quoteTitle: (n) => `Angebot ${n}`,
    date: "Datum:",
    preparedBy: "Erstellt von:",
    client: "Kunde",
    vatPrefix: "USt-IdNr.:",
    contacts: "Kontakte",
    terms: "Konditionen",
    paymentTerms: "Zahlungsbedingungen:",
    currency: "Währung:",
    taxNoteWithTaxEu: (taxLabel) =>
      `Positionspreise zzgl. MwSt. ${taxLabel} wird dem Gesamtbetrag hinzugefügt.`,
    taxNoteWithTaxUs:
      "Positionspreise ohne Umsatzsteuer. Die US-Umsatzsteuer wird dem Gesamtbetrag hinzugefügt.",
    taxNoteNoTaxEu: "Preise zzgl. MwSt.",
    taxNoteNoTaxUs: "Positionspreise ohne Umsatzsteuer.",
    product: "Produkt",
    finish: "Ausführung",
    qty: "Menge",
    unitPrice: "Stückpreis",
    afterDiscount: "Nach Rabatt",
    amount: "Betrag",
    subtotalExcl: (tax) => `Zwischensumme (ohne ${tax})`,
    totalIncl: (tax) => `Gesamt (inkl. ${tax})`,
    totalExclVat: "Gesamt (ohne MwSt.)",
    totalExclSalesTax: "Gesamt (ohne Umsatzsteuer)",
    footer:
      "MEAVO — Büro-Telefonkabinen · meavo.com · Dieses Angebot ist 30 Tage ab dem oben genannten Datum gültig.",
    taxLabelVat: "MwSt.",
    taxLabelSalesTax: "Umsatzsteuer",
    paymentTermsLabels: {
      UPFRONT_100: "100% im Voraus",
      SPLIT_50_50: "50% / 50%",
      NET_7: "Netto 7",
      NET_30: "Netto 7",
    },
    finishLabels: {
      CUSTOM: "Sonderanfertigung",
      WHITE_STOCK: "Weiß (Lager)",
      BLACK_STOCK: "Schwarz (Lager)",
      LDF_COLOUR: "LDF-Farbe",
    },
    percentOff: (n) => `${n}% Rabatt`,
    fixedOffUnit: (money) => `${money} Rabatt/Stk.`,
  },
  fr: {
    documentTitle: (n) => `${n} — Devis MEAVO`,
    quoteTitle: (n) => `Devis ${n}`,
    date: "Date :",
    preparedBy: "Préparé par :",
    client: "Client",
    vatPrefix: "N° TVA :",
    contacts: "Contacts",
    terms: "Conditions",
    paymentTerms: "Conditions de paiement :",
    currency: "Devise :",
    taxNoteWithTaxEu: (taxLabel) =>
      `Les prix des lignes sont hors TVA. ${taxLabel} est ajoutée au total.`,
    taxNoteWithTaxUs:
      "Les prix des lignes excluent la taxe de vente. La taxe de vente américaine est ajoutée au total.",
    taxNoteNoTaxEu: "Les prix sont hors TVA.",
    taxNoteNoTaxUs: "Les prix des lignes excluent la taxe de vente.",
    product: "Produit",
    finish: "Finition",
    qty: "Qté",
    unitPrice: "Prix unitaire",
    afterDiscount: "Après remise",
    amount: "Montant",
    subtotalExcl: (tax) => `Sous-total (hors ${tax})`,
    totalIncl: (tax) => `Total (TTC, ${tax})`,
    totalExclVat: "Total (hors TVA)",
    totalExclSalesTax: "Total (hors taxe de vente)",
    footer:
      "MEAVO — cabines téléphoniques de bureau · meavo.com · Ce devis est valable 30 jours à compter de la date ci-dessus.",
    taxLabelVat: "TVA",
    taxLabelSalesTax: "Taxe de vente",
    paymentTermsLabels: {
      UPFRONT_100: "100 % d'avance",
      SPLIT_50_50: "50 % / 50 %",
      NET_7: "Net 7",
      NET_30: "Net 7",
    },
    finishLabels: {
      CUSTOM: "Sur mesure",
      WHITE_STOCK: "Stock blanc",
      BLACK_STOCK: "Stock noir",
      LDF_COLOUR: "Couleur LDF",
    },
    percentOff: (n) => `${n} % de remise`,
    fixedOffUnit: (money) => `${money} de remise/unité`,
  },
};

export function quotePdfMessages(lang: QuotePdfLang): QuotePdfMessages {
  return MESSAGES[lang];
}

export function formatMoneyForPdf(
  amount: number | string,
  currency: string,
  lang: QuotePdfLang,
): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LANG_LOCALES[lang], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateForPdf(
  date: Date | null | undefined,
  lang: QuotePdfLang,
): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(LANG_LOCALES[lang], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDiscountLabelForPdf(
  discountType: LineItemDiscountType,
  discountValue: number,
  currency: string,
  lang: QuotePdfLang,
): string | null {
  if (discountType === "NONE" || discountValue <= 0) return null;
  const t = quotePdfMessages(lang);
  if (discountType === "PERCENT") return t.percentOff(discountValue);
  return t.fixedOffUnit(formatMoneyForPdf(discountValue, currency, lang));
}

function formatVatRate(rate: number): string {
  return `${(rate * 100).toFixed((rate * 100) % 1 === 0 ? 0 : 1)}%`;
}

export function taxLabelForMarketForPdf(
  market: string,
  lang: QuotePdfLang,
): string {
  const t = quotePdfMessages(lang);
  return market.trim().toUpperCase() === "US" ? t.taxLabelSalesTax : t.taxLabelVat;
}

export function formatTaxLineLabelForPdf(
  market: string,
  vatRate: number,
  lang: QuotePdfLang,
): string {
  const label = taxLabelForMarketForPdf(market, lang);
  if (market.trim().toUpperCase() === "US") return label;
  return `${label} (${formatVatRate(vatRate)})`;
}

export function quotePdfFilename(quoteNumber: string, lang: QuotePdfLang): string {
  if (lang === "en") return `${quoteNumber}-meavo-quote.pdf`;
  return `${quoteNumber}-meavo-quote-${lang}.pdf`;
}
