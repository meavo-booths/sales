import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "xero";

export async function getXeroSettings() {
  return prisma.xeroIntegrationSettings.findUnique({ where: { id: SETTINGS_ID } });
}

export async function upsertXeroSettings(data: {
  setupConfirmedAt?: Date | null;
  defaultBrandingThemeId?: string | null;
  defaultBrandingThemeName?: string | null;
  defaultTaxType?: string | null;
  defaultAccountCode?: string | null;
  defaultAccountName?: string | null;
  lastXeroItemsSyncAt?: Date;
}) {
  return prisma.xeroIntegrationSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...data },
    update: data,
  });
}

/** True once an admin has reviewed and confirmed the mappings. */
export async function isXeroSetupConfirmed(): Promise<boolean> {
  const settings = await getXeroSettings();
  return Boolean(settings?.setupConfirmedAt);
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
