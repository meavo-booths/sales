import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listItems } from "@/lib/xero/resources";
import { upsertXeroSettings } from "@/lib/xero/settings";

export type XeroItemsImportResult = {
  created: number;
  updated: number;
  deactivated: number;
  skippedNoCode: number;
};

/**
 * One-way import Xero Items -> Product table.
 *
 * Xero owns commercial fields (name, description, list price, active state).
 * Sales-only fields — kind, families, images, availability, add-on
 * restrictions — are never touched, so re-syncing can't wipe local config.
 * New items default to BOOTH; the team reclassifies add-ons in the UI.
 */
export async function importItemsFromXero(): Promise<XeroItemsImportResult> {
  const items = await listItems();
  const result: XeroItemsImportResult = {
    created: 0,
    updated: 0,
    deactivated: 0,
    skippedNoCode: 0,
  };

  const seenItemIds = new Set<string>();

  for (const item of items) {
    if (!item.Code) {
      result.skippedNoCode += 1;
      continue;
    }
    seenItemIds.add(item.ItemID);

    const commercial = {
      name: item.Name || item.Code,
      description: item.Description ?? "",
      listPrice: new Prisma.Decimal((item.SalesDetails?.UnitPrice ?? 0).toFixed(2)),
      isActive: item.IsSold,
      xeroItemCode: item.Code,
      xeroSyncedAt: new Date(),
    };

    const existing = await prisma.product.findFirst({
      where: { OR: [{ xeroItemId: item.ItemID }, { xeroItemCode: item.Code }] },
      select: { id: true },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...commercial, xeroItemId: item.ItemID },
      });
      result.updated += 1;
    } else {
      await prisma.product.create({
        data: { ...commercial, xeroItemId: item.ItemID, kind: "BOOTH" },
      });
      result.created += 1;
    }
  }

  // Items removed in Xero (or no longer sold): soft-deactivate, keep the row —
  // historical quotes reference it.
  const stale = await prisma.product.updateMany({
    where: { xeroItemId: { notIn: [...seenItemIds], not: null }, isActive: true },
    data: { isActive: false, xeroSyncedAt: new Date() },
  });
  result.deactivated = stale.count;

  await upsertXeroSettings({ lastXeroItemsSyncAt: new Date() });
  return result;
}
