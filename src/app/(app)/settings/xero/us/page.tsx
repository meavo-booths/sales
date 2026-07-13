import { prisma } from "@/lib/prisma";
import { requireSalesAdmin } from "@/lib/meavo-auth";
import { isXeroConfigured } from "@/lib/xero/client";
import { getXeroSettings } from "@/lib/xero/settings";
import { PageHeader } from "@/components/ui";
import { XeroUsSetupForm } from "@/components/xero-us-setup";

export const dynamic = "force-dynamic";

export default async function XeroUsSettingsPage() {
  await requireSalesAdmin();

  const [settings, stateMappings] = await Promise.all([
    getXeroSettings(),
    prisma.xeroUsStateMapping.findMany({ orderBy: { state: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Xero US integration"
        description="Map each US state to invoice template, revenue account, exempt product tax type, and sales tax liability account for Zamp-computed US sales tax."
      />
      <XeroUsSetupForm
        configured={isXeroConfigured()}
        usSetupConfirmedAt={settings?.usSetupConfirmedAt?.toISOString() ?? null}
        initialStateMappings={stateMappings.map((m) => ({
          state: m.state,
          brandingThemeId: m.brandingThemeId,
          brandingThemeName: m.brandingThemeName,
          accountCode: m.accountCode,
          accountName: m.accountName,
          taxType: m.taxType,
          taxName: m.taxName,
          taxRate: m.taxRate === null ? null : Number(m.taxRate),
          taxAccountCode: m.taxAccountCode,
          taxAccountName: m.taxAccountName,
        }))}
        initialDefaults={{
          brandingThemeId: settings?.defaultUsBrandingThemeId ?? null,
          brandingThemeName: settings?.defaultUsBrandingThemeName ?? null,
          accountCode: settings?.defaultUsAccountCode ?? null,
          accountName: settings?.defaultUsAccountName ?? null,
          taxType: settings?.defaultUsTaxType ?? null,
          taxAccountCode: settings?.defaultUsTaxAccountCode ?? null,
          taxAccountName: settings?.defaultUsTaxAccountName ?? null,
        }}
      />
    </div>
  );
}
