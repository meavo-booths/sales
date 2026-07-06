"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";

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

    await prisma.product.create({
      data: {
        name,
        sku,
        kind,
        description,
        listPrice: parsePrice(formData.get("listPrice")),
        imageUrl,
        ...(boothIds.length > 0
          ? {
              addOnRestrictions: {
                create: boothIds.map((boothId) => ({ boothId })),
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

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          name,
          sku,
          kind,
          description,
          listPrice: parsePrice(formData.get("listPrice")),
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
