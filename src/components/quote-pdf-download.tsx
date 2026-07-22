"use client";

import { useState } from "react";
import {
  QUOTE_PDF_LANGS,
  QUOTE_PDF_LANG_LABELS,
  defaultQuotePdfLang,
  type QuotePdfLang,
} from "@/lib/quote-pdf-messages";

export function QuotePdfDownload({
  quoteId,
  market,
  label = "Download PDF",
}: {
  quoteId: string;
  market: string;
  label?: string;
}) {
  const [lang, setLang] = useState<QuotePdfLang>(() => defaultQuotePdfLang(market));
  const href = `/api/quotes/${quoteId}/pdf?lang=${lang}`;

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white">
      <a
        href={href}
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        {label}
      </a>
      <label className="sr-only" htmlFor={`quote-pdf-lang-${quoteId}`}>
        PDF language
      </label>
      <select
        id={`quote-pdf-lang-${quoteId}`}
        value={lang}
        onChange={(e) => setLang(e.target.value as QuotePdfLang)}
        className="border-l border-slate-300 bg-white px-2 py-2 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:bg-slate-50"
        aria-label="PDF language"
      >
        {QUOTE_PDF_LANGS.map((code) => (
          <option key={code} value={code}>
            {QUOTE_PDF_LANG_LABELS[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
