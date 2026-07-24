/**
 * PDF-only i18n for quote downloads. The Sales UI stays English;
 * product/line names are never translated here.
 */
import type { PaymentTerms, ProductFinish } from "@prisma/client";
import type { LineItemDiscountType } from "@/lib/line-item-pricing";

export const QUOTE_PDF_LANGS = ["en", "en-US", "es", "it", "de", "fr"] as const;
export type QuotePdfLang = (typeof QUOTE_PDF_LANGS)[number];

export const QUOTE_PDF_LANG_LABELS: Record<QuotePdfLang, string> = {
  en: "English (UK)",
  "en-US": "English (US)",
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
  US: "en-US",
};

const LANG_LOCALES: Record<QuotePdfLang, string> = {
  en: "en-GB",
  "en-US": "en-US",
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
  validityNote: string;
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
  termsHeading: string;
  termsBullets: string[];
  footerLines: string[];
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
    validityNote: "Quote is valid for 30 days, subject to availability.",
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
    termsHeading: "PLEASE NOTE:",
    termsBullets: [
      "Delivery: Staircase carrying is included up to the 2nd floor. If the lift is too small or unavailable additional charges may apply for staircase carrying beyond the 2nd floor. Installation: The ceiling must be at least 240cm tall to facilitate installation.",
      "Environmental impact: For every phone booth purchased we plant 15 trees in Madagascar (www.ecologi.com/meavo) and donate 2 solar lamps to families in Zambia (www.solar-aid.org). In addition, the acoustic felt in each booth contains over 800 recycled plastic bottles, helping keep our environment clean.",
      "Terms & conditions: By placing an order you accept our terms & conditions (www.meavo.com/terms-and-conditions)",
    ],
    footerLines: [
      "Questions? Give us a ring: +44 (0) 203 488 5200",
      "MEAVO Limited | International House, 12 Constance St, London E16 2DQ, United Kingdom | VAT #: GB294870555 | Companies House #: 11177638",
    ],
    taxLabelVat: "VAT",
    taxLabelSalesTax: "Sales tax",
    paymentTermsLabels: PAYMENT_EN,
    finishLabels: FINISH_EN,
    percentOff: (n) => `${n}% off`,
    fixedOffUnit: (money) => `${money} off/unit`,
  },
  "en-US": {
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
    validityNote: "Quote is valid for 30 days, subject to availability.",
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
    termsHeading: "Please Note:",
    termsBullets: [
      "Seating: The Soho / Haven One phone booths and the Workstation / Haven focus pods do NOT come with any seating such as a barstool or office chair. We suggest sourcing these from an online retailer such as Amazon or Wayfair.",
      "Delivery: Staircase carrying is included up to the 2nd floor. If the lift is too small or unavailable additional charges may apply for staircase carrying beyond the 2nd floor. Installation: The ceiling must be at least 94.5\" / 240cm tall to facilitate installation.",
      "Environmental impact: For every phone booth purchased we plant 15 trees in Madagascar (www.ecologi.com/meavo) and donate 2 solar lamps to families in Zambia (www.solar-aid.org). In addition, the acoustic felt in each booth contains over 800 recycled plastic bottles, helping keep our environment clean.",
      "Terms & conditions: By placing an order you accept our terms & conditions (www.meavo.com/terms-and-conditions)",
    ],
    footerLines: [
      "Questions? Give us a ring: (+1) 646-503-0642",
      "MEAVO Limited | International House, 12 Constance St, London E16 2DQ, United Kingdom | Companies House #: 11177638",
    ],
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
    validityNote: "Presupuesto válido durante 30 días, sujeto a disponibilidad.",
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
    termsHeading: "Notas:",
    termsBullets: [
      "Triangulación exenta de IVA según el artículo 141 de la Directiva Europea 2006/112/UE",
      "NOTA: El techo debe tener una altura mínima de 240 cm para facilitar la instalación.",
      "Impacto medioambiental: Por cada cabina telefónica comprada plantamos 15 árboles en Madagascar (www.ecologi.com/meavo) y donamos 2 lámparas solares a familias de Zambia (www.solar-aid.org). Además, el fieltro acústico de cada cabina contiene más de 800 botellas de plástico recicladas, lo que contribuye a mantener limpio nuestro entorno.",
      "Términos & Condiciones: www.meavo.com/terms-and-conditions",
    ],
    footerLines: [
      "¿Preguntas? Escríbenos a: hola@meavo.com",
      "MEAVO Limited | International House, 12 Constance St, Londres E16 2DQ, Reino Unido",
      "Número de IVA intracomunitario: DE343397319 | Número Companies House: 11177638",
    ],
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
    validityNote: "Preventivo valido per 30 giorni, soggetto a disponibilità.",
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
    termsHeading: "Note:",
    termsBullets: [
      "Triangolazione, IVA esente ai sensi dell'articolo 141 della Direttiva Europea 2006/112/CE",
      "ATTENZIONE: Il soffitto deve avere un'altezza minima di 240 cm per consentire l'installazione.",
      "Impatto ambientale: Per ogni phone booth acquistato, piantiamo 15 alberi in Madagascar (www.ecologi.com/meavo) e doniamo 2 lampade solari a famiglie in Zambia (www.solar-aid.org). Inoltre, il feltro acustico di ogni cabina contiene oltre 800 bottiglie di plastica riciclate, contribuendo a mantenere pulito il nostro ambiente.",
      "I nostri termini e condizioni: www.meavo.com/terms-and-conditions",
    ],
    footerLines: [
      "MEAVO Limited | International House, 12 Constance St, London E16 2DQ, United Kingdom",
      "EU Triangulation: Finanzamt Hannover-Nord, Germany | German VAT number: DE343397319 | Germany Tax ID: 25/249/61693",
    ],
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
    validityNote: "Angebot gültig für 30 Tage, vorbehaltlich der Verfügbarkeit.",
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
    termsHeading: "Weitere Angaben:",
    termsBullets: [
      "BITTE BEACHTEN: Die Deckenhöhe muss mindestens 240cm betragen, um die Montage zu ermöglichen.",
      "Unser Beitrag zum Umweltschutz: Pro verkaufter Telefonzelle pflanzen wir 15 Bäume in Madagaskar (www.ecologi.com/meavo) und spenden 2 Solarlampen an Familien in Sambia (www.solar-aid.org). In den Akustikpaneelen in einer unserer Telefonkabinen sind zudem über 800 recycelte Plastikflaschen verarbeitet.",
      "Unsere Allgemeinen Geschäftsbedingungen: www.meavo.com/terms-and-conditions",
    ],
    footerLines: [
      "Fragen? Kontaktiere uns: hallo@meavo.com",
      "MEAVO Limited | International House, 12 Constance St, London E16 2DQ, Vereinigtes Königreich",
      "Finanzamt Hannover-Nord | USt-ID: DE343397319 | Steuernummer: 25/249/61693",
    ],
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
    validityNote: "Devis valable 30 jours, sous réserve de disponibilité.",
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
    termsHeading: "Notes et instructions:",
    termsBullets: [
      "Application de l'article 141 de la directive 2006/112/CE du Conseil, du 28 novembre 2006.",
      "Note importante: la hauteur sous plafond doit être au minimum de 240cm pour faciliter l'installation.",
      "Impact environnemental: Pour chaque cabine téléphonique achetée, nous plantons 15 arbres à Madagascar (www.ecologi.com/meavo). Nous faisons également don de 2 lampes solaires à des familles en Zambie (www.solar-aid.org). Le feutre acoustique des cabines contient plus de 800 bouteilles en plastique recyclées, ce qui contribue à préserver notre environnement.",
      "Conditions générales de vente: www.meavo.com/terms-and-conditions",
    ],
    footerLines: [
      "Pour toute question à propos de cette facture, merci de nous contacter: bonjour@meavo.com",
      "MEAVO Limited | International House, 12 Constance St, Londres E16 2DQ, Royaume-Uni",
      "Numéro de TVA intracommunautaire: DE343397319 | Numéro d'immatriculation: 11177638",
    ],
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
