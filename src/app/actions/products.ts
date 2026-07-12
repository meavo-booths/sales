"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import {
  Prisma,
  type AddOnProductFamily,
  type BoothProductFamily,
  type DealClientType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSalesAccess } from "@/lib/meavo-auth";
import {
  ADDON_FAMILY_OPTIONS,
  BOOTH_FAMILY_OPTIONS,
} from "@/lib/deal-values";
import { isQuoteCurrency, type QuoteCurrency } from "@/lib/exchange-rates";

export type ProductActionState = { error?: string; success?: boolean };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BOOTH_FAMILIES = new Set<string>(BOOTH_FAMILY_OPTIONS);
const ADDON_FAMILIES = new Set<string>(ADDON_FAMILY_OPTIONS);

/** Allowed image types: validate MIME and extension (both client-controlled,
 * so they must agree), and never trust the client filename for the blob path. */
const IMAGE_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 5MB");

  const allowedExtensions = IMAGE_EXTENSIONS_BY_MIME[file.type];
  if (!allowedExtensions) throw new Error("Image must be a JPEG, PNG, WebP, or GIF");

  const extension = allowedExtensions.find((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
  if (!extension) throw new Error("Image file extension does not match its type");

  const blob = await put(`products/image${extension}`, file, {
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

/** Booth families an add-on is limited to. Empty array = available for any family. */
function parseBoothFamilies(formData: FormData): BoothProductFamily[] {
  return [
    ...new Set(
      formData
        .getAll("boothFamilies")
        .map((v) => String(v).trim())
        .filter((v): v is BoothProductFamily => BOOTH_FAMILIES.has(v)),
    ),
  ];
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

function parseBoothFamily(formData: FormData): BoothProductFamily | null {
  const raw = String(formData.get("boothFamily") ?? "").trim();
  return BOOTH_FAMILIES.has(raw) ? (raw as BoothProductFamily) : null;
}

function parseAddOnFamily(formData: FormData): AddOnProductFamily | null {
  const raw = String(formData.get("addOnFamily") ?? "").trim();
  return ADDON_FAMILIES.has(raw) ? (raw as AddOnProductFamily) : null;
}

function parseTaxCode(formData: FormData): string {
  return String(formData.get("taxCode") ?? "").trim();
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  await requireSalesAccess();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Name is required" };

  const kind = parseKind(formData.get("kind"));
  const boothFamily = kind === "BOOTH" ? parseBoothFamily(formData) : null;
  const addOnFamily = kind === "ADDON" ? parseAddOnFamily(formData) : null;
  if (kind === "BOOTH" && !boothFamily) return { error: "Product family is required" };
  if (kind === "ADDON" && !addOnFamily) return { error: "Product family is required" };

  try {
    const image = formData.get("image");
    const imageUrl =
      image instanceof File && image.size > 0 ? await uploadImage(image) : null;

    const boothFamilies = kind === "ADDON" ? parseBoothFamilies(formData) : [];
    const availability = parseAvailability(formData);
    const currency = parseCurrency(formData);

    await prisma.product.create({
      data: {
        name,
        kind,
        boothFamily: boothFamily ?? undefined,
        addOnFamily: addOnFamily ?? undefined,
        description,
        listPrice: parsePrice(formData.get("listPrice")),
        currency,
        imageUrl,
        taxCode: parseTaxCode(formData),
        ...(boothFamilies.length > 0
          ? {
              familyRestrictions: {
                create: boothFamilies.map((family) => ({ boothFamily: family })),
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
  const description = String(formData.get("description") ?? "").trim();
  if (!id) return { error: "Missing product" };
  if (!name) return { error: "Name is required" };

  const kind = parseKind(formData.get("kind"));
  const boothFamily = kind === "BOOTH" ? parseBoothFamily(formData) : null;
  const addOnFamily = kind === "ADDON" ? parseAddOnFamily(formData) : null;
  if (kind === "BOOTH" && !boothFamily) return { error: "Product family is required" };
  if (kind === "ADDON" && !addOnFamily) return { error: "Product family is required" };

  try {
    const image = formData.get("image");
    const imageUrl =
      image instanceof File && image.size > 0 ? await uploadImage(image) : undefined;

    const boothFamilies = kind === "ADDON" ? parseBoothFamilies(formData) : [];
    const availability = parseAvailability(formData);
    const currency = parseCurrency(formData);

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          name,
          kind,
          boothFamily: kind === "BOOTH" ? boothFamily : null,
          addOnFamily: kind === "ADDON" ? addOnFamily : null,
          description,
          listPrice: parsePrice(formData.get("listPrice")),
          currency,
          isActive: formData.get("isActive") === "on",
          taxCode: parseTaxCode(formData),
          ...(imageUrl ? { imageUrl } : {}),
        },
      }),
      prisma.productAddOnFamilyRestriction.deleteMany({ where: { addOnId: id } }),
      ...(boothFamilies.length > 0
        ? [
            prisma.productAddOnFamilyRestriction.createMany({
              data: boothFamilies.map((boothFamily) => ({ addOnId: id, boothFamily })),
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
    return { error: error instanceof Error ? error.message : "Could not update product" };
  }

  revalidatePath("/products");
  return { success: true };
}
