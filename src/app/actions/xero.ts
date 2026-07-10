"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess, requireSalesAdmin } from "@/lib/meavo-auth";
import { isXeroConfigured } from "@/lib/xero/client";
import {
  listBrandingThemes,
  listRevenueAccounts,
  listRevenueTaxRates,
  type XeroAccount,
  type XeroBrandingTheme,
  type XeroTaxRate,
} from "@/lib/xero/resources";
import { exportDealToXero } from "@/lib/xero/export-deal";
import { importItemsFromXero, type XeroItemsImportResult } from "@/lib/xero/import-items";
import { getXeroSettings, upsertXeroSettings } from "@/lib/xero/settings";

export type XeroSetupData = {
  configured: boolean;
  themes: XeroBrandingTheme[];
  taxRates: XeroTaxRate[];
  accounts: XeroAccount[];
  error?: string;
};

/** Verify credentials and load live themes, revenue tax rates and revenue accounts from Xero. */
export async function loadXeroSetupDataAction(): Promise<XeroSetupData> {
  await requireSalesAdmin();

  if (!isXeroConfigured()) {
    return {
      configured: false,
      themes: [],
      taxRates: [],
      accounts: [],
      error: "XERO_CLIENT_ID / XERO_CLIENT_SECRET are not set",
    };
  }

  try {
    const [themes, taxRates, accounts] = await Promise.all([
      listBrandingThemes(),
      listRevenueTaxRates(),
      listRevenueAccounts(),
    ]);
    return { configured: true, themes, taxRates, accounts };
  } catch (error) {
    return {
      configured: true,
      themes: [],
      taxRates: [],
      accounts: [],
      error: error instanceof Error ? error.message : "Could not reach Xero",
    };
  }
}

const mappingsInputSchema = z.object({
  themeMappings: z.array(
    z.object({
      market: z.string().min(1),
      brandingThemeId: z.string(),
      brandingThemeName: z.string(),
    }),
  ),
  taxMappings: z.array(
    z.object({
      market: z.string().min(1),
      taxType: z.string(),
      taxName: z.string(),
      taxRate: z.number().nullable(),
    }),
  ),
  accountMappings: z.array(
    z.object({
      market: z.string().min(1),
      accountCode: z.string(),
      accountName: z.string(),
    }),
  ),
  defaultBrandingThemeId: z.string().nullable(),
  defaultBrandingThemeName: z.string().nullable(),
  defaultTaxType: z.string().nullable(),
  defaultAccountCode: z.string().nullable(),
  defaultAccountName: z.string().nullable(),
});

export type XeroMappingsInput = z.infer<typeof mappingsInputSchema>;

export type XeroActionResult = { ok: true } | { ok: false; error: string };

/**
 * Replace the market mappings with the admin-confirmed selection. Saving
 * always clears the confirmation — the admin re-confirms after any edit.
 */
export async function saveXeroMappingsAction(rawInput: unknown): Promise<XeroActionResult> {
  await requireSalesAdmin();

  const parsed = mappingsInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Invalid mapping input" };
  const input = parsed.data;

  const themeRows = input.themeMappings.filter((m) => m.brandingThemeId);
  const taxRows = input.taxMappings.filter((m) => m.taxType);
  const accountRows = input.accountMappings.filter((m) => m.accountCode);

  await prisma.$transaction([
    prisma.xeroMarketThemeMapping.deleteMany({}),
    ...(themeRows.length > 0
      ? [prisma.xeroMarketThemeMapping.createMany({ data: themeRows })]
      : []),
    prisma.xeroMarketTaxMapping.deleteMany({}),
    ...(taxRows.length > 0
      ? [
          prisma.xeroMarketTaxMapping.createMany({
            data: taxRows.map((m) => ({
              market: m.market,
              taxType: m.taxType,
              taxName: m.taxName,
              taxRate: m.taxRate === null ? null : new Prisma.Decimal(m.taxRate.toFixed(3)),
            })),
          }),
        ]
      : []),
    prisma.xeroMarketAccountMapping.deleteMany({}),
    ...(accountRows.length > 0
      ? [prisma.xeroMarketAccountMapping.createMany({ data: accountRows })]
      : []),
  ]);

  await upsertXeroSettings({
    defaultBrandingThemeId: input.defaultBrandingThemeId,
    defaultBrandingThemeName: input.defaultBrandingThemeName,
    defaultTaxType: input.defaultTaxType,
    defaultAccountCode: input.defaultAccountCode,
    defaultAccountName: input.defaultAccountName,
    setupConfirmedAt: null,
  });

  revalidatePath("/settings/xero");
  return { ok: true };
}

export async function confirmXeroSetupAction(): Promise<XeroActionResult> {
  await requireSalesAdmin();

  const settings = await getXeroSettings();
  const themeCount = await prisma.xeroMarketThemeMapping.count();
  const taxCount = await prisma.xeroMarketTaxMapping.count();
  const accountCount = await prisma.xeroMarketAccountMapping.count();

  if (themeCount === 0 && !settings?.defaultBrandingThemeId) {
    return { ok: false, error: "Map at least one market or set a default branding theme first" };
  }
  if (taxCount === 0 && !settings?.defaultTaxType) {
    return { ok: false, error: "Map at least one market or set a default tax type first" };
  }
  if (accountCount === 0 && !settings?.defaultAccountCode && !process.env.XERO_SALES_ACCOUNT_CODE) {
    return { ok: false, error: "Map at least one market or set a default revenue account first" };
  }

  await upsertXeroSettings({ setupConfirmedAt: new Date() });
  revalidatePath("/settings/xero");
  return { ok: true };
}

export type XeroProductSyncResult =
  | ({ ok: true } & XeroItemsImportResult)
  | { ok: false; error: string };

export async function syncProductsFromXeroAction(): Promise<XeroProductSyncResult> {
  await requireSalesAccess();

  if (!isXeroConfigured()) return { ok: false, error: "Xero is not configured" };

  try {
    const result = await importItemsFromXero();
    revalidatePath("/products");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Product sync failed",
    };
  }
}

/** Retry creating the Xero draft invoice after a failed win-time export. */
export async function retryXeroInvoiceAction(dealDbId: string): Promise<XeroActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: { stage: true, xeroInvoiceId: true },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals create Xero invoices" };
  if (deal.xeroInvoiceId) return { ok: false, error: "This deal already has a Xero invoice" };

  await exportDealToXero(dealDbId);
  revalidatePath(`/deals/${dealDbId}`);

  const updated = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: { xeroInvoiceId: true, xeroSyncError: true },
  });
  if (!updated?.xeroInvoiceId) {
    return { ok: false, error: updated?.xeroSyncError ?? "Xero invoice creation failed" };
  }
  return { ok: true };
}
