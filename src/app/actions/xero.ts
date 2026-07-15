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
  listTaxLiabilityAccounts,
  type XeroAccount,
  type XeroBrandingTheme,
  type XeroTaxRate,
} from "@/lib/xero/resources";
import { createDealXeroInvoice, primaryInvoicePhase } from "@/lib/xero/export-deal";
import { importItemsFromXero, type XeroItemsImportResult } from "@/lib/xero/import-items";
import { getXeroSettings, upsertXeroSettings } from "@/lib/xero/settings";
import { firstZodError } from "@/lib/zod-errors";

export type XeroSetupData = {
  configured: boolean;
  themes: XeroBrandingTheme[];
  taxRates: XeroTaxRate[];
  accounts: XeroAccount[];
  taxLiabilityAccounts: XeroAccount[];
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
      taxLiabilityAccounts: [],
      error: "XERO_CLIENT_ID / XERO_CLIENT_SECRET are not set",
    };
  }

  try {
    const [themes, taxRates, accounts, taxLiabilityAccounts] = await Promise.all([
      listBrandingThemes(),
      listRevenueTaxRates(),
      listRevenueAccounts(),
      listTaxLiabilityAccounts(),
    ]);
    return { configured: true, themes, taxRates, accounts, taxLiabilityAccounts };
  } catch (error) {
    return {
      configured: true,
      themes: [],
      taxRates: [],
      accounts: [],
      taxLiabilityAccounts: [],
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
  taxAccountMappings: z.array(
    z.object({
      market: z.string().min(1),
      taxAccountCode: z.string(),
      taxAccountName: z.string(),
    }),
  ),
  defaultBrandingThemeId: z.string().nullable(),
  defaultBrandingThemeName: z.string().nullable(),
  defaultTaxType: z.string().nullable(),
  defaultAccountCode: z.string().nullable(),
  defaultAccountName: z.string().nullable(),
  defaultTaxAccountCode: z.string().nullable(),
  defaultTaxAccountName: z.string().nullable(),
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
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const themeRows = input.themeMappings.filter((m) => m.brandingThemeId);
  const taxRows = input.taxMappings.filter((m) => m.taxType);
  const accountRows = input.accountMappings.filter((m) => m.accountCode);
  const taxAccountRows = input.taxAccountMappings.filter((m) => m.taxAccountCode);

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
    prisma.xeroMarketTaxAccountMapping.deleteMany({}),
    ...(taxAccountRows.length > 0
      ? [prisma.xeroMarketTaxAccountMapping.createMany({ data: taxAccountRows })]
      : []),
  ]);

  await upsertXeroSettings({
    defaultBrandingThemeId: input.defaultBrandingThemeId,
    defaultBrandingThemeName: input.defaultBrandingThemeName,
    defaultTaxType: input.defaultTaxType,
    defaultAccountCode: input.defaultAccountCode,
    defaultAccountName: input.defaultAccountName,
    defaultTaxAccountCode: input.defaultTaxAccountCode,
    defaultTaxAccountName: input.defaultTaxAccountName,
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

const usMappingsInputSchema = z.object({
  stateMappings: z.array(
    z.object({
      state: z.string().min(2).max(2),
      brandingThemeId: z.string(),
      brandingThemeName: z.string(),
      accountCode: z.string(),
      accountName: z.string(),
      taxType: z.string(),
      taxName: z.string(),
      taxRate: z.number().nullable(),
      taxAccountCode: z.string(),
      taxAccountName: z.string(),
    }),
  ),
  defaultUsBrandingThemeId: z.string().nullable(),
  defaultUsBrandingThemeName: z.string().nullable(),
  defaultUsAccountCode: z.string().nullable(),
  defaultUsAccountName: z.string().nullable(),
  defaultUsTaxType: z.string().nullable(),
  defaultUsTaxAccountCode: z.string().nullable(),
  defaultUsTaxAccountName: z.string().nullable(),
});

export type XeroUsMappingsInput = z.infer<typeof usMappingsInputSchema>;

export async function saveXeroUsMappingsAction(rawInput: unknown): Promise<XeroActionResult> {
  await requireSalesAdmin();

  const parsed = usMappingsInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
  const input = parsed.data;

  const rows = input.stateMappings.filter(
    (m) => m.brandingThemeId || m.accountCode || m.taxType || m.taxAccountCode,
  );

  await prisma.$transaction([
    prisma.xeroUsStateMapping.deleteMany({}),
    ...(rows.length > 0
      ? [
          prisma.xeroUsStateMapping.createMany({
            data: rows.map((m) => ({
              state: m.state,
              brandingThemeId: m.brandingThemeId,
              brandingThemeName: m.brandingThemeName,
              accountCode: m.accountCode,
              accountName: m.accountName,
              taxType: m.taxType,
              taxName: m.taxName,
              taxRate: m.taxRate === null ? null : new Prisma.Decimal(m.taxRate.toFixed(3)),
              taxAccountCode: m.taxAccountCode,
              taxAccountName: m.taxAccountName,
            })),
          }),
        ]
      : []),
  ]);

  await upsertXeroSettings({
    defaultUsBrandingThemeId: input.defaultUsBrandingThemeId,
    defaultUsBrandingThemeName: input.defaultUsBrandingThemeName,
    defaultUsAccountCode: input.defaultUsAccountCode,
    defaultUsAccountName: input.defaultUsAccountName,
    defaultUsTaxType: input.defaultUsTaxType,
    defaultUsTaxAccountCode: input.defaultUsTaxAccountCode,
    defaultUsTaxAccountName: input.defaultUsTaxAccountName,
    usSetupConfirmedAt: null,
  });

  revalidatePath("/settings/xero/us");
  return { ok: true };
}

export async function confirmXeroUsSetupAction(): Promise<XeroActionResult> {
  await requireSalesAdmin();

  const settings = await getXeroSettings();
  const stateCount = await prisma.xeroUsStateMapping.count();

  const hasDefaults = Boolean(
    settings?.defaultUsBrandingThemeId &&
      settings?.defaultUsAccountCode &&
      settings?.defaultUsTaxType &&
      settings?.defaultUsTaxAccountCode,
  );

  if (stateCount === 0 && !hasDefaults) {
    return {
      ok: false,
      error:
        "Map at least one US state or set all US defaults (theme, revenue account, tax type, tax liability account)",
    };
  }

  await upsertXeroSettings({ usSetupConfirmedAt: new Date() });
  revalidatePath("/settings/xero/us");
  return { ok: true };
}

export type XeroProductSyncResult =
  | ({ ok: true } & XeroItemsImportResult)
  | { ok: false; error: string };

export async function syncProductsFromXeroAction(): Promise<XeroProductSyncResult> {
  await requireSalesAdmin();

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
  return createXeroInvoiceAction(dealDbId);
}

/** Create the primary Xero invoice (full or 50% advance) for a won deal. */
export async function createXeroInvoiceAction(dealDbId: string): Promise<XeroActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: { stage: true, paymentTerms: true, xeroInvoiceId: true },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals create Xero invoices" };
  if (deal.xeroInvoiceId) return { ok: false, error: "This deal already has a Xero invoice" };

  const phase = primaryInvoicePhase(deal.paymentTerms);
  const result = await createDealXeroInvoice(dealDbId, { phase });
  revalidatePath(`/deals/${dealDbId}`);

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Create the final 50% Xero invoice for a split-payment deal. */
export async function createXeroFinalInvoiceAction(dealDbId: string): Promise<XeroActionResult> {
  await requireSalesAccess();

  const deal = await prisma.deal.findUnique({
    where: { id: dealDbId },
    select: {
      stage: true,
      paymentTerms: true,
      xeroInvoiceId: true,
      xeroFinalInvoiceId: true,
    },
  });
  if (!deal) return { ok: false, error: "Deal not found" };
  if (deal.stage !== "WON") return { ok: false, error: "Only won deals create Xero invoices" };
  if (deal.paymentTerms !== "SPLIT_50_50") {
    return { ok: false, error: "Final invoices apply only to 50/50 payment terms" };
  }
  if (!deal.xeroInvoiceId) {
    return { ok: false, error: "Create the advance invoice before the final invoice" };
  }
  if (deal.xeroFinalInvoiceId) {
    return { ok: false, error: "This deal already has a final Xero invoice" };
  }

  const result = await createDealXeroInvoice(dealDbId, { phase: "final" });
  revalidatePath(`/deals/${dealDbId}`);

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
