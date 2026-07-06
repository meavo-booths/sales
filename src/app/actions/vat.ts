"use server";

import { requireSalesAccess } from "@/lib/meavo-auth";

export type VatCheckResult =
  | { status: "valid"; name: string; address: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string };

/** EU member states as VIES knows them (Greece is EL; XI is Northern Ireland). */
const VIES_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK", "XI",
]);

const FETCH_TIMEOUT_MS = 8_000;

/** VIES returns "---" when a member state withholds the trader details. */
function cleanTraderField(value: unknown): string {
  const text = String(value ?? "").trim();
  return text === "---" ? "" : text;
}

async function checkVies(countryCode: string, vatNumber: string): Promise<VatCheckResult> {
  const response = await fetch(
    "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode, vatNumber }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return { status: "error", message: `VIES is unavailable right now (HTTP ${response.status}). Try again later.` };
  }

  const data = (await response.json()) as {
    valid?: boolean;
    isValid?: boolean;
    name?: string;
    address?: string;
    traderName?: string;
    traderAddress?: string;
    actionSucceed?: boolean;
    errorWrappers?: { error?: string }[];
  };

  const wrapperError = data.errorWrappers?.[0]?.error;
  if (data.actionSucceed === false || wrapperError) {
    return {
      status: "error",
      message: `VIES could not process the check${wrapperError ? ` (${wrapperError})` : ""}. The member state's service may be down — try again later.`,
    };
  }

  const valid = data.valid ?? data.isValid;
  if (valid === true) {
    return {
      status: "valid",
      name: cleanTraderField(data.name ?? data.traderName),
      address: cleanTraderField(data.address ?? data.traderAddress),
    };
  }
  return {
    status: "invalid",
    message: `${countryCode} ${vatNumber} is not registered in VIES. Note: VIES only lists numbers activated for intra-EU trade.`,
  };
}

/**
 * On-demand VAT number check: EU numbers (and Northern Ireland XI) against
 * the European Commission's VIES database. GB numbers can't be checked
 * automatically — HMRC removed its open-access lookup in Feb 2025 and v2
 * requires registered OAuth credentials. Informational only — never blocks
 * saving.
 */
export async function checkVatAction(rawVatNumber: string): Promise<VatCheckResult> {
  await requireSalesAccess();

  const normalized = String(rawVatNumber ?? "")
    .toUpperCase()
    .replace(/[\s.\-]/g, "");
  const match = normalized.match(/^([A-Z]{2})([A-Z0-9+*]{2,12})$/);
  if (!match) {
    return {
      status: "error",
      message: "Enter the VAT number with its country prefix, e.g. DE123456789 or GB123456789.",
    };
  }

  // Greece registers under EL in VIES.
  const countryCode = match[1] === "GR" ? "EL" : match[1];
  const vatNumber = match[2];

  try {
    if (countryCode === "GB") {
      return {
        status: "error",
        message:
          "UK numbers can't be checked automatically (HMRC requires registered API credentials). Verify manually at gov.uk/check-uk-vat-number.",
      };
    }
    if (VIES_COUNTRY_CODES.has(countryCode)) return await checkVies(countryCode, vatNumber);
    return {
      status: "error",
      message: `"${countryCode}" is not an EU or UK country prefix, so this number can't be checked.`,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The VAT check service did not respond in time. Try again later."
        : "Could not reach the VAT check service. Try again later.";
    return { status: "error", message };
  }
}
