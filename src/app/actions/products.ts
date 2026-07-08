"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { Prisma, type DealClientType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import { isQuoteCurrency, type QuoteCurrency } from "@/lib/exchange-rates";

export type ProductActionState = { error?: string; success?: boolean };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5MB");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");

  const blob = await put(`products/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}

function parsePrice(value: FormDataEntryValue | null): Prisma.Decimal {
  const raw = String(value ?? "").trim().replace(/[€\s,]/g, "");
  const amount = raw ? Number.parseFloat(raw) : 0;
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid price");
  return new Prisma.Decimal(amount.toFixed(2));
}

function parseKind(value: FormDataEntryValue | null): "BOOTH" | "ADDON" {
  return value === "ADDON" ? "ADDON" : "BOOTH";
}

/** Booth ids an add-on is limited to. Empty array = available for any booth. */
function parseBoothIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("boothIds").map((v) => String(v).trim()).filter(Boolean))];
}

const CLIENT_TYPES: DealClientType[] = ["DIRECT", "AGENCY", "COWORKING"];

/** Market × client type rows. Empty = available for all combinations. */
function parseAvailability(formData: FormData): { market: string; clientType: DealClientType }[] {
  const markets = [
    ...new Set(formData.getAll("markets").map((v) => String(v).trim()).filter(Boolean)),
  ];
  const clientTypes = [
    ...new Set(
      formData
        .getAll("clientTypes")
        .map((v) => String(v).trim())
        .filter((v): v is DealClientType => CLIENT_TYPES.includes(v as DealClientType)),
    ),
  ];
  if (markets.length === 0 || clientTypes.length === 0) return [];

  const rows: { market: string; clientType: DealClientType }[] = [];
  for (const market of markets) {
    for (const clientType of clientTypes) {
      rows.push({ market, clientType });
    }
  }
  return rows;
}

function parseCurrency(formData: FormData): QuoteCurrency {
  const raw = String(formData.get("currency") ?? "EUR").trim();
  return isQuoteCurrency(raw) ? raw : "EUR";
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireSalesAccess();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Name is required" };
  if (!sku) return { error: "SKU is required" };

  try {
    const image = formData.get("image");
    const imageUrl =
      image instanceof File && image.size > 0 ? await uploadImage(image) : null;

    const kind = parseKind(formData.get("kind"));
    const boothIds = kind === "ADDON" ? parseBoothIds(formData) : [];
    const availability = parseAvailability(formData);
    const currency = parseCurrency(formData);

    await prisma.product.create({
      data: {
        name,
        sku,
        kind,
        description,
        listPrice: parsePrice(formData.get("listPrice")),
        currency,
        imageUrl,
        ...(boothIds.length > 0
          ? {
              addOnRestrictions: {
                create: boothIds.map((boothId) => ({ boothId })),
              },
            }
          : {}),
        ...(availability.length > 0
          ? {
              availability: {
                create: availability,
              },
            }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `A product with SKU ${sku} already exists` };
    }
    return { error: error instanceof Error ? error.message : "Could not create product" };
  }

  revalidatePath("/products");
  return { success: true };
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireSalesAccess();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const description = String(formData.get("description") ?? "").trim();
  if (!id) return { error: "Missing product" };
  if (!name) return { error: "Name is required" };
  if (!sku) return { error: "SKU is required" };

  try {
    const image = formData.get("image");
    const imageUrl =
      image instanceof File && image.size > 0 ? await uploadImage(image) : undefined;

    const kind = parseKind(formData.get("kind"));
    const boothIds = kind === "ADDON" ? parseBoothIds(formData) : [];
    const availability = parseAvailability(formData);
    const currency = parseCurrency(formData);

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          name,
          sku,
          kind,
          description,
          listPrice: parsePrice(formData.get("listPrice")),
          currency,
          isActive: formData.get("isActive") === "on",
          ...(imageUrl ? { imageUrl } : {}),
        },
      }),
      prisma.productAddOnRestriction.deleteMany({ where: { addOnId: id } }),
      ...(boothIds.length > 0
        ? [
            prisma.productAddOnRestriction.createMany({
              data: boothIds.map((boothId) => ({ addOnId: id, boothId })),
            }),
          ]
        : []),
      prisma.productAvailability.deleteMany({ where: { productId: id } }),
      ...(availability.length > 0
        ? [
            prisma.productAvailability.createMany({
              data: availability.map((row) => ({ productId: id, ...row })),
            }),
          ]
        : []),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `A product with SKU ${sku} already exists` };
    }
    return { error: error instanceof Error ? error.message : "Could not update product" };
  }

  revalidatePath("/products");
  return { success: true };
}
