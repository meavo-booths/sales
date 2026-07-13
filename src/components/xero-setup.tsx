"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MARKET_OPTIONS } from "@/lib/deal-values";
import { vatRateForMarket } from "@/lib/vat";
import { suggestTaxLiabilityAccount } from "@/lib/xero/suggestions";
import {
  confirmXeroSetupAction,
  loadXeroSetupDataAction,
  saveXeroMappingsAction,
  syncProductsFromXeroAction,
  type XeroSetupData,
} from "@/app/actions/xero";
import { Badge, Button, Card, Select } from "@/components/ui";

/** International markets — US is configured per-state on /settings/xero/us. */
const INTERNATIONAL_MARKET_OPTIONS = MARKET_OPTIONS.filter((market) => market !== "US");

type ThemeMapping = { market: string; brandingThemeId: string; brandingThemeName: string };
type TaxMapping = { market: string; taxType: string; taxName: string; taxRate: number | null };
type AccountMapping = { market: string; accountCode: string; accountName: string };
type TaxAccountMapping = { market: string; taxAccountCode: string; taxAccountName: string };

type Props = {
  configured: boolean;
  setupConfirmedAt: string | null;
  initialThemeMappings: ThemeMapping[];
  initialTaxMappings: TaxMapping[];
  initialAccountMappings: AccountMapping[];
  initialTaxAccountMappings: TaxAccountMapping[];
  initialDefaults: {
    brandingThemeId: string | null;
    brandingThemeName: string | null;
    taxType: string | null;
    accountCode: string | null;
    accountName: string | null;
    taxAccountCode: string | null;
    taxAccountName: string | null;
  };
};

/** Case-insensitive name match with a few common aliases, used for suggestions only. */
function suggestThemeId(market: string, themes: XeroSetupData["themes"]): string {
  const aliases: Record<string, string[]> = {
    UK: ["uk", "united kingdom", "gb", "english"],
    US: ["us", "usa", "united states"],
    Germany: ["germany", "german", "de"],
    France: ["france", "french", "fr"],
    Spain: ["spain", "spanish", "es"],
    Italy: ["italy", "italian", "it"],
    Portugal: ["portugal", "portuguese", "pt"],
  };
  const candidates = aliases[market] ?? [market.toLowerCase()];
  const match = themes.find((theme) =>
    candidates.some((alias) => theme.Name.trim().toLowerCase() === alias),
  );
  return match?.BrandingThemeID ?? "";
}

/** Suggest the Xero tax rate whose percentage equals the market's VAT rate. */
function suggestTaxType(market: string, taxRates: XeroSetupData["taxRates"]): string {
  const targetPercent = vatRateForMarket(market) * 100;
  const match = taxRates.find((rate) => Math.abs(rate.EffectiveRate - targetPercent) < 0.001);
  return match?.TaxType ?? "";
}

/**
 * Suggest the revenue account whose name contains a market keyword as a whole
 * token (e.g. Germany -> "201 Sales DACH", CZ-SK -> "203 Sales other EU/EEA").
 */
function suggestAccountCode(market: string, accounts: XeroSetupData["accounts"]): string {
  const keywords: Record<string, string[]> = {
    UK: ["uk"],
    US: ["us", "usa"],
    Germany: ["dach"],
    France: ["fr"],
    Spain: ["es"],
    Italy: ["it"],
    Portugal: ["pt"],
    Balkans: ["eea"],
    "CZ-SK": ["eea"],
    RoW: ["eea"],
  };
  const candidates = keywords[market];
  if (!candidates) return "";
  const match = accounts.find((account) => {
    const tokens = account.Name.toLowerCase().split(/[^a-z0-9]+/);
    return candidates.some((keyword) => tokens.includes(keyword));
  });
  return match?.Code ?? "";
}

export function XeroSetupForm({
  configured,
  setupConfirmedAt,
  initialThemeMappings,
  initialTaxMappings,
  initialAccountMappings,
  initialTaxAccountMappings,
  initialDefaults,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<XeroSetupData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [themeByMarket, setThemeByMarket] = useState<Record<string, string>>(
    Object.fromEntries(initialThemeMappings.map((m) => [m.market, m.brandingThemeId])),
  );
  const [taxByMarket, setTaxByMarket] = useState<Record<string, string>>(
    Object.fromEntries(initialTaxMappings.map((m) => [m.market, m.taxType])),
  );
  const [accountByMarket, setAccountByMarket] = useState<Record<string, string>>(
    Object.fromEntries(initialAccountMappings.map((m) => [m.market, m.accountCode])),
  );
  const [taxAccountByMarket, setTaxAccountByMarket] = useState<Record<string, string>>(
    Object.fromEntries(initialTaxAccountMappings.map((m) => [m.market, m.taxAccountCode])),
  );
  const [defaultTheme, setDefaultTheme] = useState(initialDefaults.brandingThemeId ?? "");
  const [defaultTax, setDefaultTax] = useState(initialDefaults.taxType ?? "");
  const [defaultAccount, setDefaultAccount] = useState(initialDefaults.accountCode ?? "");
  const [defaultTaxAccount, setDefaultTaxAccount] = useState(initialDefaults.taxAccountCode ?? "");

  const themes = data?.themes ?? [];
  const taxRates = data?.taxRates ?? [];
  const accounts = data?.accounts ?? [];
  const taxLiabilityAccounts = data?.taxLiabilityAccounts ?? [];
  const loaded = themes.length > 0;

  const load = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await loadXeroSetupDataAction();
      setData(result);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(
        `Connected. Loaded ${result.themes.length} branding themes, ${result.taxRates.length} revenue tax rates, ` +
          `${result.accounts.length} revenue accounts and ${result.taxLiabilityAccounts.length} liability accounts from Xero.`,
      );
      // Pre-fill empty dropdowns with name/rate suggestions; the admin still
      // reviews and saves explicitly.
      setThemeByMarket((prev) => {
        const next = { ...prev };
        for (const market of INTERNATIONAL_MARKET_OPTIONS) {
          if (!next[market]) next[market] = suggestThemeId(market, result.themes);
        }
        return next;
      });
      setTaxByMarket((prev) => {
        const next = { ...prev };
        for (const market of INTERNATIONAL_MARKET_OPTIONS) {
          if (!next[market]) next[market] = suggestTaxType(market, result.taxRates);
        }
        return next;
      });
      setAccountByMarket((prev) => {
        const next = { ...prev };
        for (const market of INTERNATIONAL_MARKET_OPTIONS) {
          if (!next[market]) next[market] = suggestAccountCode(market, result.accounts);
        }
        return next;
      });
      const taxAccountSuggestion = suggestTaxLiabilityAccount(result.taxLiabilityAccounts);
      setTaxAccountByMarket((prev) => {
        const next = { ...prev };
        for (const market of INTERNATIONAL_MARKET_OPTIONS) {
          if (!next[market]) next[market] = taxAccountSuggestion;
        }
        return next;
      });
      if (!defaultTaxAccount) setDefaultTaxAccount(taxAccountSuggestion);
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const themeName = (id: string) =>
        themes.find((t) => t.BrandingThemeID === id)?.Name ?? "";
      const taxInfo = (type: string) => taxRates.find((t) => t.TaxType === type);
      const accountName = (code: string) => accounts.find((a) => a.Code === code)?.Name ?? "";
      const taxAccountName = (code: string) =>
        taxLiabilityAccounts.find((a) => a.Code === code)?.Name ?? "";

      const result = await saveXeroMappingsAction({
        themeMappings: INTERNATIONAL_MARKET_OPTIONS.filter((market) => themeByMarket[market]).map((market) => ({
          market,
          brandingThemeId: themeByMarket[market],
          brandingThemeName: themeName(themeByMarket[market]),
        })),
        taxMappings: INTERNATIONAL_MARKET_OPTIONS.filter((market) => taxByMarket[market]).map((market) => ({
          market,
          taxType: taxByMarket[market],
          taxName: taxInfo(taxByMarket[market])?.Name ?? "",
          taxRate: taxInfo(taxByMarket[market])?.EffectiveRate ?? null,
        })),
        accountMappings: INTERNATIONAL_MARKET_OPTIONS.filter((market) => accountByMarket[market]).map(
          (market) => ({
            market,
            accountCode: accountByMarket[market],
            accountName: accountName(accountByMarket[market]),
          }),
        ),
        taxAccountMappings: INTERNATIONAL_MARKET_OPTIONS.filter(
          (market) => taxAccountByMarket[market],
        ).map((market) => ({
          market,
          taxAccountCode: taxAccountByMarket[market],
          taxAccountName: taxAccountName(taxAccountByMarket[market]),
        })),
        defaultBrandingThemeId: defaultTheme || null,
        defaultBrandingThemeName: defaultTheme ? themeName(defaultTheme) : null,
        defaultTaxType: defaultTax || null,
        defaultAccountCode: defaultAccount || null,
        defaultAccountName: defaultAccount ? accountName(defaultAccount) : null,
        defaultTaxAccountCode: defaultTaxAccount || null,
        defaultTaxAccountName: defaultTaxAccount ? taxAccountName(defaultTaxAccount) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Mappings saved. Review them and confirm setup to enable auto-invoicing.");
      router.refresh();
    });

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await confirmXeroSetupAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Setup confirmed — won deals now create draft invoices in Xero.");
      router.refresh();
    });

  const syncProducts = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await syncProductsFromXeroAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `Products synced from Xero: ${result.created} created, ${result.updated} updated, ` +
          `${result.deactivated} deactivated${result.skippedNoCode > 0 ? `, ${result.skippedNoCode} skipped (no item code)` : ""}.`,
      );
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Connection</h2>
            {!configured ? (
              <Badge tone="red">Not configured</Badge>
            ) : setupConfirmedAt ? (
              <Badge tone="green">Active — setup confirmed</Badge>
            ) : (
              <Badge tone="amber">Setup not confirmed</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={pending || !configured}>
              {pending ? "Working…" : loaded ? "Reload from Xero" : "Test connection & load"}
            </Button>
            <Button variant="secondary" onClick={syncProducts} disabled={pending || !configured}>
              Sync products from Xero
            </Button>
          </div>
        </div>
        {!configured && (
          <p className="mt-3 text-sm text-slate-600">
            Set <code>XERO_CLIENT_ID</code> and <code>XERO_CLIENT_SECRET</code> (a Xero Custom
            Connection with the <code>accounting.invoices accounting.contacts
            accounting.settings.read</code> scopes) to enable the integration.
          </p>
        )}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <h2 className="mb-1 text-base font-semibold text-slate-900">International market mappings</h2>
        <p className="mb-4 text-sm text-slate-500">
          VAT posts via Xero Tax Type on product lines. Tax liability account is recorded here for
          reference — it does not affect invoice export yet. US deals are configured per state on{" "}
          <a href="/settings/xero/us" className="text-blue-700 underline">
            Settings → Xero US
          </a>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Market</th>
                <th className="py-2 pr-4">Invoice template (branding theme)</th>
                <th className="py-2 pr-4">VAT / tax rate</th>
                <th className="py-2 pr-4">Revenue account</th>
                <th className="py-2 pr-4">Tax liability account</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {INTERNATIONAL_MARKET_OPTIONS.map((market) => {
                const mapped = Boolean(
                  themeByMarket[market] && taxByMarket[market] && accountByMarket[market],
                );
                return (
                  <tr key={market} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-900">{market}</td>
                    <td className="py-2 pr-4">
                      <Select
                        value={themeByMarket[market] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setThemeByMarket((prev) => ({ ...prev, [market]: e.target.value }))
                        }
                      >
                        <option value="">— use default —</option>
                        {themes.map((theme) => (
                          <option key={theme.BrandingThemeID} value={theme.BrandingThemeID}>
                            {theme.Name}
                            {theme.SortOrder === 0 ? " (org default)" : ""}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={taxByMarket[market] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setTaxByMarket((prev) => ({ ...prev, [market]: e.target.value }))
                        }
                      >
                        <option value="">— use default —</option>
                        {taxRates.map((rate) => (
                          <option key={rate.TaxType} value={rate.TaxType}>
                            {rate.Name} ({rate.EffectiveRate}%)
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={accountByMarket[market] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setAccountByMarket((prev) => ({ ...prev, [market]: e.target.value }))
                        }
                      >
                        <option value="">— use default —</option>
                        {accounts.map((account) => (
                          <option key={account.AccountID} value={account.Code}>
                            {account.Code} · {account.Name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={taxAccountByMarket[market] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setTaxAccountByMarket((prev) => ({ ...prev, [market]: e.target.value }))
                        }
                      >
                        <option value="">— use default —</option>
                        {taxLiabilityAccounts.map((account) => (
                          <option key={account.AccountID} value={account.Code}>
                            {account.Code} · {account.Name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2">
                      {mapped ? (
                        <Badge tone="green">Mapped</Badge>
                      ) : (
                        <Badge tone="slate">Uses defaults</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Default branding theme (fallback for unmapped markets)"
            value={defaultTheme}
            disabled={!loaded}
            onChange={(e) => setDefaultTheme(e.target.value)}
          >
            <option value="">— none (unmapped markets fail with an error) —</option>
            {themes.map((theme) => (
              <option key={theme.BrandingThemeID} value={theme.BrandingThemeID}>
                {theme.Name}
                {theme.SortOrder === 0 ? " (org default)" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Default tax rate (fallback for unmapped markets)"
            value={defaultTax}
            disabled={!loaded}
            onChange={(e) => setDefaultTax(e.target.value)}
          >
            <option value="">— none (unmapped markets fail with an error) —</option>
            {taxRates.map((rate) => (
              <option key={rate.TaxType} value={rate.TaxType}>
                {rate.Name} ({rate.EffectiveRate}%)
              </option>
            ))}
          </Select>
          <Select
            label="Default revenue account (fallback for unmapped markets)"
            value={defaultAccount}
            disabled={!loaded}
            onChange={(e) => setDefaultAccount(e.target.value)}
          >
            <option value="">— none (unmapped markets fail with an error) —</option>
            {accounts.map((account) => (
              <option key={account.AccountID} value={account.Code}>
                {account.Code} · {account.Name}
              </option>
            ))}
          </Select>
          <Select
            label="Default tax liability account (reference only)"
            value={defaultTaxAccount}
            disabled={!loaded}
            onChange={(e) => setDefaultTaxAccount(e.target.value)}
          >
            <option value="">— none —</option>
            {taxLiabilityAccounts.map((account) => (
              <option key={account.AccountID} value={account.Code}>
                {account.Code} · {account.Name}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending || !loaded}>
            Save mappings
          </Button>
          <Button
            variant="secondary"
            onClick={confirm}
            disabled={pending || Boolean(setupConfirmedAt)}
          >
            {setupConfirmedAt ? "Setup confirmed" : "Confirm setup — enable auto-invoicing"}
          </Button>
          {setupConfirmedAt && (
            <span className="text-xs text-slate-500">
              Confirmed {new Date(setupConfirmedAt).toLocaleString("en-GB")}. Saving changes
              requires re-confirming.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
