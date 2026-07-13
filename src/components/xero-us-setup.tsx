"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmXeroUsSetupAction,
  loadXeroSetupDataAction,
  saveXeroUsMappingsAction,
  type XeroSetupData,
} from "@/app/actions/xero";
import { US_STATES } from "@/lib/us-state";
import { suggestTaxLiabilityAccount } from "@/lib/xero/suggestions";
import { Badge, Button, Card, Input, Select } from "@/components/ui";

type StateMapping = {
  state: string;
  brandingThemeId: string;
  brandingThemeName: string;
  accountCode: string;
  accountName: string;
  taxType: string;
  taxName: string;
  taxRate: number | null;
  taxAccountCode: string;
  taxAccountName: string;
};

type Props = {
  configured: boolean;
  usSetupConfirmedAt: string | null;
  initialStateMappings: StateMapping[];
  initialDefaults: {
    brandingThemeId: string | null;
    brandingThemeName: string | null;
    accountCode: string | null;
    accountName: string | null;
    taxType: string | null;
    taxAccountCode: string | null;
    taxAccountName: string | null;
  };
};

function suggestUsTheme(themes: XeroSetupData["themes"]): string {
  const match = themes.find((theme) =>
    ["us", "usa", "united states"].includes(theme.Name.trim().toLowerCase()),
  );
  return match?.BrandingThemeID ?? "";
}

function suggestExemptTax(taxRates: XeroSetupData["taxRates"]): string {
  const match = taxRates.find(
    (rate) =>
      rate.EffectiveRate === 0 ||
      /exempt|none|zero|out of scope/i.test(rate.Name),
  );
  return match?.TaxType ?? "";
}

function suggestUsRevenueAccount(accounts: XeroSetupData["accounts"]): string {
  const match = accounts.find((account) => {
    const tokens = account.Name.toLowerCase().split(/[^a-z0-9]+/);
    return tokens.includes("us") || tokens.includes("usa");
  });
  return match?.Code ?? "";
}

export function XeroUsSetupForm({
  configured,
  usSetupConfirmedAt,
  initialStateMappings,
  initialDefaults,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<XeroSetupData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const initialByState = Object.fromEntries(
    initialStateMappings.map((m) => [m.state, m]),
  );

  const [themeByState, setThemeByState] = useState<Record<string, string>>(
    Object.fromEntries(
      US_STATES.map((s) => [s.code, initialByState[s.code]?.brandingThemeId ?? ""]),
    ),
  );
  const [taxByState, setTaxByState] = useState<Record<string, string>>(
    Object.fromEntries(
      US_STATES.map((s) => [s.code, initialByState[s.code]?.taxType ?? ""]),
    ),
  );
  const [accountByState, setAccountByState] = useState<Record<string, string>>(
    Object.fromEntries(
      US_STATES.map((s) => [s.code, initialByState[s.code]?.accountCode ?? ""]),
    ),
  );
  const [taxAccountByState, setTaxAccountByState] = useState<Record<string, string>>(
    Object.fromEntries(
      US_STATES.map((s) => [s.code, initialByState[s.code]?.taxAccountCode ?? ""]),
    ),
  );

  const [defaultTheme, setDefaultTheme] = useState(initialDefaults.brandingThemeId ?? "");
  const [defaultTax, setDefaultTax] = useState(initialDefaults.taxType ?? "");
  const [defaultAccount, setDefaultAccount] = useState(initialDefaults.accountCode ?? "");
  const [defaultTaxAccount, setDefaultTaxAccount] = useState(
    initialDefaults.taxAccountCode ?? "",
  );

  const themes = data?.themes ?? [];
  const taxRates = data?.taxRates ?? [];
  const accounts = data?.accounts ?? [];
  const taxLiabilityAccounts = data?.taxLiabilityAccounts ?? [];
  const loaded = themes.length > 0;

  const filteredStates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return US_STATES;
    return US_STATES.filter(
      (state) =>
        state.code.toLowerCase().includes(q) || state.name.toLowerCase().includes(q),
    );
  }, [filter]);

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
        `Connected. Loaded ${result.themes.length} themes, ${result.taxRates.length} tax rates, ` +
          `${result.accounts.length} revenue accounts and ${result.taxLiabilityAccounts.length} liability accounts.`,
      );

      const themeSuggestion = suggestUsTheme(result.themes);
      const taxSuggestion = suggestExemptTax(result.taxRates);
      const accountSuggestion = suggestUsRevenueAccount(result.accounts);
      const taxAccountSuggestion = suggestTaxLiabilityAccount(result.taxLiabilityAccounts);

      setThemeByState((prev) => {
        const next = { ...prev };
        for (const state of US_STATES) {
          if (!next[state.code]) next[state.code] = themeSuggestion;
        }
        return next;
      });
      setTaxByState((prev) => {
        const next = { ...prev };
        for (const state of US_STATES) {
          if (!next[state.code]) next[state.code] = taxSuggestion;
        }
        return next;
      });
      setAccountByState((prev) => {
        const next = { ...prev };
        for (const state of US_STATES) {
          if (!next[state.code]) next[state.code] = accountSuggestion;
        }
        return next;
      });
      setTaxAccountByState((prev) => {
        const next = { ...prev };
        for (const state of US_STATES) {
          if (!next[state.code]) next[state.code] = taxAccountSuggestion;
        }
        return next;
      });
      if (!defaultTheme) setDefaultTheme(themeSuggestion);
      if (!defaultTax) setDefaultTax(taxSuggestion);
      if (!defaultAccount) setDefaultAccount(accountSuggestion);
      if (!defaultTaxAccount) setDefaultTaxAccount(taxAccountSuggestion);
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const themeName = (id: string) => themes.find((t) => t.BrandingThemeID === id)?.Name ?? "";
      const taxInfo = (type: string) => taxRates.find((t) => t.TaxType === type);
      const accountName = (code: string) => accounts.find((a) => a.Code === code)?.Name ?? "";
      const taxAccountName = (code: string) =>
        taxLiabilityAccounts.find((a) => a.Code === code)?.Name ?? "";

      const result = await saveXeroUsMappingsAction({
        stateMappings: US_STATES.filter(
          (state) =>
            themeByState[state.code] ||
            taxByState[state.code] ||
            accountByState[state.code] ||
            taxAccountByState[state.code],
        ).map((state) => ({
          state: state.code,
          brandingThemeId: themeByState[state.code] ?? "",
          brandingThemeName: themeName(themeByState[state.code] ?? ""),
          accountCode: accountByState[state.code] ?? "",
          accountName: accountName(accountByState[state.code] ?? ""),
          taxType: taxByState[state.code] ?? "",
          taxName: taxInfo(taxByState[state.code] ?? "")?.Name ?? "",
          taxRate: taxInfo(taxByState[state.code] ?? "")?.EffectiveRate ?? null,
          taxAccountCode: taxAccountByState[state.code] ?? "",
          taxAccountName: taxAccountName(taxAccountByState[state.code] ?? ""),
        })),
        defaultUsBrandingThemeId: defaultTheme || null,
        defaultUsBrandingThemeName: defaultTheme ? themeName(defaultTheme) : null,
        defaultUsAccountCode: defaultAccount || null,
        defaultUsAccountName: defaultAccount ? accountName(defaultAccount) : null,
        defaultUsTaxType: defaultTax || null,
        defaultUsTaxAccountCode: defaultTaxAccount || null,
        defaultUsTaxAccountName: defaultTaxAccount ? taxAccountName(defaultTaxAccount) : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("US mappings saved. Review them and confirm setup to enable US auto-invoicing.");
      router.refresh();
    });

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await confirmXeroUsSetupAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("US setup confirmed — won US deals now create draft invoices in Xero.");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">US state mappings</h2>
            {!configured ? (
              <Badge tone="red">Not configured</Badge>
            ) : usSetupConfirmedAt ? (
              <Badge tone="green">US setup confirmed</Badge>
            ) : (
              <Badge tone="amber">US setup not confirmed</Badge>
            )}
          </div>
          <Button variant="secondary" onClick={load} disabled={pending || !configured}>
            {pending ? "Working…" : loaded ? "Reload from Xero" : "Load from Xero"}
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Product lines use the revenue account and exempt tax type. Zamp US sales tax posts to the
          tax liability account. Connection and product sync live on{" "}
          <a href="/settings/xero" className="text-blue-700 underline">
            Settings → Xero
          </a>
          .
        </p>
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Per-state configuration</h2>
            <p className="mt-1 text-sm text-slate-500">
              Map states you sell into, or rely on US defaults below for unmapped states.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <Input
              label="Filter states"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Code or name, e.g. CA or California"
            />
          </div>
        </div>

        <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pl-3 pr-4">State</th>
                <th className="py-2 pr-4">Branding theme</th>
                <th className="py-2 pr-4">Revenue account</th>
                <th className="py-2 pr-4">Product tax type</th>
                <th className="py-2 pr-3">Tax liability account</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStates.map((state) => {
                const mapped = Boolean(
                  themeByState[state.code] &&
                    taxByState[state.code] &&
                    accountByState[state.code] &&
                    taxAccountByState[state.code],
                );
                return (
                  <tr key={state.code} className="border-b border-slate-100">
                    <td className="py-2 pl-3 pr-4 font-medium text-slate-900">
                      {state.code}
                      <span className="ml-2 font-normal text-slate-500">{state.name}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={themeByState[state.code] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setThemeByState((prev) => ({ ...prev, [state.code]: e.target.value }))
                        }
                      >
                        <option value="">— use US default —</option>
                        {themes.map((theme) => (
                          <option key={theme.BrandingThemeID} value={theme.BrandingThemeID}>
                            {theme.Name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={accountByState[state.code] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setAccountByState((prev) => ({ ...prev, [state.code]: e.target.value }))
                        }
                      >
                        <option value="">— use US default —</option>
                        {accounts.map((account) => (
                          <option key={account.AccountID} value={account.Code}>
                            {account.Code} · {account.Name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-4">
                      <Select
                        value={taxByState[state.code] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setTaxByState((prev) => ({ ...prev, [state.code]: e.target.value }))
                        }
                      >
                        <option value="">— use US default —</option>
                        {taxRates.map((rate) => (
                          <option key={rate.TaxType} value={rate.TaxType}>
                            {rate.Name} ({rate.EffectiveRate}%)
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={taxAccountByState[state.code] ?? ""}
                        disabled={!loaded}
                        onChange={(e) =>
                          setTaxAccountByState((prev) => ({
                            ...prev,
                            [state.code]: e.target.value,
                          }))
                        }
                      >
                        <option value="">— use US default —</option>
                        {taxLiabilityAccounts.map((account) => (
                          <option key={account.AccountID} value={account.Code}>
                            {account.Code} · {account.Name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      {mapped ? <Badge tone="green">Mapped</Badge> : <Badge tone="slate">Defaults</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="US default branding theme"
            value={defaultTheme}
            disabled={!loaded}
            onChange={(e) => setDefaultTheme(e.target.value)}
          >
            <option value="">— none (unmapped states fail) —</option>
            {themes.map((theme) => (
              <option key={theme.BrandingThemeID} value={theme.BrandingThemeID}>
                {theme.Name}
              </option>
            ))}
          </Select>
          <Select
            label="US default revenue account"
            value={defaultAccount}
            disabled={!loaded}
            onChange={(e) => setDefaultAccount(e.target.value)}
          >
            <option value="">— none —</option>
            {accounts.map((account) => (
              <option key={account.AccountID} value={account.Code}>
                {account.Code} · {account.Name}
              </option>
            ))}
          </Select>
          <Select
            label="US default product tax type"
            value={defaultTax}
            disabled={!loaded}
            onChange={(e) => setDefaultTax(e.target.value)}
          >
            <option value="">— none —</option>
            {taxRates.map((rate) => (
              <option key={rate.TaxType} value={rate.TaxType}>
                {rate.Name} ({rate.EffectiveRate}%)
              </option>
            ))}
          </Select>
          <Select
            label="US default tax liability account"
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
            Save US mappings
          </Button>
          <Button
            variant="secondary"
            onClick={confirm}
            disabled={pending || Boolean(usSetupConfirmedAt)}
          >
            {usSetupConfirmedAt ? "US setup confirmed" : "Confirm US setup"}
          </Button>
          {usSetupConfirmedAt && (
            <span className="text-xs text-slate-500">
              Confirmed {new Date(usSetupConfirmedAt).toLocaleString("en-GB")}. Saving changes
              requires re-confirming.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
