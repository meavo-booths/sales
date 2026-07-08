"use server";

import {
  fetchExchangeRateToEur,
  isQuoteCurrency,
  type QuoteCurrency,
} from "@/lib/exchange-rates";
import { requireSalesAccess } from "@/lib/meavo-auth";

export type FxRateResult =
  | { ok: true; rate: number }
  | { ok: false; error: string };

/** Latest rate: 1 unit of `currency` equals `rate` EUR. */
export async function getFxRateToEurAction(currency: string): Promise<FxRateResult> {
  await requireSalesAccess();

  if (!isQuoteCurrency(currency)) {
    return { ok: false, error: "Unsupported currency" };
  }

  try {
    const rate = await fetchExchangeRateToEur(currency as QuoteCurrency);
    return { ok: true, rate };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not fetch FX rate",
    };
  }
}
