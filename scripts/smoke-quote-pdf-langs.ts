/**
 * Render a quote PDF in every supported language (no DB).
 * Run: npx tsx scripts/smoke-quote-pdf-langs.ts
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { QuotePdfDocument } from "../src/lib/quote-pdf";
import {
  QUOTE_PDF_LANGS,
  defaultQuotePdfLang,
} from "../src/lib/quote-pdf-messages";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const quote = {
  id: "smoke",
  quoteNumber: "MQ-99999",
  dealDate: new Date("2026-07-22T00:00:00Z"),
  salesRep: "Test Rep",
  market: "Germany",
  clientName: "Smoke Test GmbH",
  registeredAddress: "Teststrasse 1, Berlin",
  vatNumber: "DE123456789",
  paymentTerms: "SPLIT_50_50",
  currency: "EUR",
  contacts: [
    {
      id: "c1",
      kind: "MAIN",
      name: "Max Mustermann",
      email: "max@example.com",
      sortOrder: 0,
    },
  ],
  lineItems: [
    {
      id: "li1",
      parentLineItemId: null,
      quantity: 1,
      unitPrice: 4500,
      discountType: "NONE",
      discountValue: 0,
      finish: "WHITE_STOCK",
      finishDetails: null,
      description: null,
      customName: null,
      product: {
        name: "Soho",
        description: "Phone booth",
        version: "MEAVO-SOHO",
        kind: "BOOTH",
        imageUrl: null,
      },
    },
  ],
  usTaxAmount: null,
} as any;

async function main() {
  assert(defaultQuotePdfLang("Germany") === "de", "Germany → de");
  assert(defaultQuotePdfLang("Spain") === "es", "Spain → es");
  assert(defaultQuotePdfLang("Italy") === "it", "Italy → it");
  assert(defaultQuotePdfLang("France") === "fr", "France → fr");
  assert(defaultQuotePdfLang("UK") === "en", "UK → en");

  for (const lang of QUOTE_PDF_LANGS) {
    const pdf = await renderToBuffer(QuotePdfDocument({ quote, lang }));
    const out = `/tmp/meavo-lang-smoke-${lang}.pdf`;
    writeFileSync(out, pdf);
    console.log(lang, pdf.length, "bytes ->", out);
    assert(pdf.length > 1000, `PDF for lang=${lang} looks too small`);
  }
  console.log("QUOTE PDF LANG SMOKE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
