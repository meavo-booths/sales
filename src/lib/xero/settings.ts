import { prisma } from "@/lib/prisma";
import { normalizeUsState } from "@/lib/us-state";

const SETTINGS_ID = "xero";

export async function getXeroSettings() {
  return prisma.xeroIntegrationSettings.findUnique({ where: { id: SETTINGS_ID } });
}

export async function upsertXeroSettings(data: {
  setupConfirmedAt?: Date | null;
  usSetupConfirmedAt?: Date | null;
  defaultBrandingThemeId?: string | null;
  defaultBrandingThemeName?: string | null;
  defaultTaxType?: string | null;
  defaultAccountCode?: string | null;
  defaultAccountName?: string | null;
  defaultTaxAccountCode?: string | null;
  defaultTaxAccountName?: string | null;
  defaultUsBrandingThemeId?: string | null;
  defaultUsBrandingThemeName?: string | null;
  defaultUsAccountCode?: string | null;
  defaultUsAccountName?: string | null;
  defaultUsTaxType?: string | null;
  defaultUsTaxAccountCode?: string | null;
  defaultUsTaxAccountName?: string | null;
  lastXeroItemsSyncAt?: Date;
}) {
  return prisma.xeroIntegrationSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
}

/** True once both International and US mapping pages are confirmed. */
export async function isXeroSetupConfirmed(): Promise<boolean> {
  const settings = await getXeroSettings();
  return Boolean(settings?.setupConfirmedAt && settings?.usSetupConfirmedAt);
}

export async function resolveBrandingThemeForMarket(
  market: string,
): Promise<{ id: string; name: string } | null> {
  const mapping = await prisma.xeroMarketThemeMapping.findUnique({ where: { market } });
  if (mapping) return { id: mapping.brandingThemeId, name: mapping.brandingThemeName };

  const settings = await getXeroSettings();
  if (settings?.defaultBrandingThemeId) {
    return {
      id: settings.defaultBrandingThemeId,
      name: settings.defaultBrandingThemeName ?? "Default",
    };
  }
  return null;
}

export async function resolveTaxTypeForMarket(market: string): Promise<string | null> {
  const mapping = await prisma.xeroMarketTaxMapping.findUnique({ where: { market } });
  if (mapping) return mapping.taxType;

  const settings = await getXeroSettings();
  return settings?.defaultTaxType ?? null;
}

/** Market mapping -> default mapping -> XERO_SALES_ACCOUNT_CODE env fallback. */
export async function resolveAccountCodeForMarket(market: string): Promise<string | null> {
  const mapping = await prisma.xeroMarketAccountMapping.findUnique({ where: { market } });
  if (mapping) return mapping.accountCode;

  const settings = await getXeroSettings();
  return settings?.defaultAccountCode ?? process.env.XERO_SALES_ACCOUNT_CODE ?? null;
}

function normalizedState(state: string): string | null {
  const code = normalizeUsState(state);
  return code || null;
}

export async function resolveBrandingThemeForUsState(
  state: string,
): Promise<{ id: string; name: string } | null> {
  const code = normalizedState(state);
  if (!code) return null;

  const mapping = await prisma.xeroUsStateMapping.findUnique({ where: { state: code } });
  if (mapping?.brandingThemeId) {
    return { id: mapping.brandingThemeId, name: mapping.brandingThemeName };
  }

  const settings = await getXeroSettings();
  if (settings?.defaultUsBrandingThemeId) {
    return {
      id: settings.defaultUsBrandingThemeId,
      name: settings.defaultUsBrandingThemeName ?? "US default",
    };
  }
  return null;
}

export async function resolveTaxTypeForUsState(state: string): Promise<string | null> {
  const code = normalizedState(state);
  if (!code) return null;

  const mapping = await prisma.xeroUsStateMapping.findUnique({ where: { state: code } });
  if (mapping?.taxType) return mapping.taxType;

  const settings = await getXeroSettings();
  return settings?.defaultUsTaxType ?? null;
}

export async function resolveAccountCodeForUsState(state: string): Promise<string | null> {
  const code = normalizedState(state);
  if (!code) return null;

  const mapping = await prisma.xeroUsStateMapping.findUnique({ where: { state: code } });
  if (mapping?.accountCode) return mapping.accountCode;

  const settings = await getXeroSettings();
  return settings?.defaultUsAccountCode ?? null;
}

export async function resolveTaxAccountCodeForUsState(state: string): Promise<string | null> {
  const code = normalizedState(state);
  if (!code) return null;

  const mapping = await prisma.xeroUsStateMapping.findUnique({ where: { state: code } });
  if (mapping?.taxAccountCode) return mapping.taxAccountCode;

  const settings = await getXeroSettings();
  return settings?.defaultUsTaxAccountCode ?? null;
}
