import { prisma } from "@/lib/prisma";
import { requireSalesAdmin } from "@/lib/meavo-auth";
import { isXeroConfigured } from "@/lib/xero/client";
import { getXeroSettings } from "@/lib/xero/settings";
import { PageHeader } from "@/components/ui";
import { XeroSetupForm } from "@/components/xero-setup";

export const dynamic = "force-dynamic";

export default async function XeroSettingsPage() {
  await requireSalesAdmin();

  const [settings, themeMappings, taxMappings, accountMappings, taxAccountMappings] =
    await Promise.all([
    getXeroSettings(),
    prisma.xeroMarketThemeMapping.findMany(),
    prisma.xeroMarketTaxMapping.findMany(),
    prisma.xeroMarketAccountMapping.findMany(),
    prisma.xeroMarketTaxAccountMapping.findMany(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Xero integration"
        description="Map international sales markets to Xero invoice templates, VAT rates and revenue accounts. US deals are configured per state on Xero US."
      />
      <XeroSetupForm
        configured={isXeroConfigured()}
        setupConfirmedAt={settings?.setupConfirmedAt?.toISOString() ?? null}
        initialThemeMappings={themeMappings.map((m) => ({
          market: m.market,
          brandingThemeId: m.brandingThemeId,
          brandingThemeName: m.brandingThemeName,
        }))}
        initialTaxMappings={taxMappings.map((m) => ({
          market: m.market,
          taxType: m.taxType,
          taxName: m.taxName,
          taxRate: m.taxRate === null ? null : Number(m.taxRate),
        }))}
        initialAccountMappings={accountMappings.map((m) => ({
          market: m.market,
          accountCode: m.accountCode,
          accountName: m.accountName,
        }))}
        initialTaxAccountMappings={taxAccountMappings.map((m) => ({
          market: m.market,
          taxAccountCode: m.taxAccountCode,
          taxAccountName: m.taxAccountName,
        }))}
        initialDefaults={{
          brandingThemeId: settings?.defaultBrandingThemeId ?? null,
          brandingThemeName: settings?.defaultBrandingThemeName ?? null,
          taxType: settings?.defaultTaxType ?? null,
          accountCode: settings?.defaultAccountCode ?? null,
          accountName: settings?.defaultAccountName ?? null,
          taxAccountCode: settings?.defaultTaxAccountCode ?? null,
          taxAccountName: settings?.defaultTaxAccountName ?? null,
        }}
      />
    </div>
  );
}
