export const QUOTE_CURRENCIES = ["EUR", "GBP", "CZK", "USD"] as const;
export type QuoteCurrency = (typeof QUOTE_CURRENCIES)[number];

export function isQuoteCurrency(value: string): value is QuoteCurrency {
  return (QUOTE_CURRENCIES as readonly string[]).includes(value);
}

export function parseProductCurrency(value: string): QuoteCurrency {
  return isQuoteCurrency(value) ? value : "EUR";
}

/**
 * Returns how many EUR one unit of `currency` is worth
 * (e.g. 1 GBP = 1.17 EUR → returns 1.17).
 */
export async function fetchExchangeRateToEur(currency: QuoteCurrency): Promise<number> {
  if (currency === "EUR") return 1;

  const response = await fetch(
    `https://api.frankfurter.app/latest?from=${currency}&to=EUR`,
    { next: { revalidate: 3600 } },
  );
  if (!response.ok) {
    throw new Error(`Could not fetch FX rate for ${currency}`);
  }

  const data = (await response.json()) as { rates?: { EUR?: number } };
  const rate = data.rates?.EUR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate for ${currency}`);
  }
  return rate;
}

/** Convert between quote currencies using rates-to-EUR (EUR = 1). */
export function convertBetweenQuoteCurrencies(
  amount: number,
  from: QuoteCurrency,
  to: QuoteCurrency,
  rateToEur: Partial<Record<QuoteCurrency, number>>,
): number {
  if (from === to) return amount;

  const fromRate = from === "EUR" ? 1 : rateToEur[from];
  const toRate = to === "EUR" ? 1 : rateToEur[to];
  if (!fromRate || !toRate || fromRate <= 0 || toRate <= 0) return amount;

  return Number(((amount * fromRate) / toRate).toFixed(2));
}

/** Convert a EUR catalog list price into the selected quote currency. */
export function convertEurToQuoteCurrency(
  eurAmount: number,
  currency: QuoteCurrency,
  exchangeRateToEur: number,
): number {
  return convertBetweenQuoteCurrencies(
    eurAmount,
    "EUR",
    currency,
    { [currency]: exchangeRateToEur },
  );
}
