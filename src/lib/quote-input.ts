import { z } from "zod";
import { QUOTE_CURRENCIES } from "@/lib/exchange-rates";
import { DELIVERY_TYPE_OPTIONS } from "@/lib/deal-values";
import { normalizeUsState } from "@/lib/us-state";
import { normalizeZampZip } from "@/lib/zamp/payload";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const optionalDateString = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")])
  .default("")
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

export const contactInputSchema = z.object({
  kind: z.enum(["MAIN", "FINANCE", "ASSEMBLY"]),
  name: z.string().trim().min(1, "Contact name is required"),
  email: z
    .string()
    .trim()
    .default("")
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "Contact email is not a valid email address",
    }),
  phone: z.string().trim().default(""),
  role: z.string().trim().default(""),
});

/** Add-on line — no finish; can be attached to a booth line or standalone. */
export const addOnInputSchema = z.object({
  productId: z.string().min(1, "Pick an add-on"),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(9_999_999),
  description: z.string().trim().default(""),
});

export const lineItemInputSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(9_999_999),
  finish: z.enum(["CUSTOM", "WHITE_STOCK", "BLACK_STOCK", "LDF_COLOUR"]),
  finishDetails: z.string().trim().default(""),
  description: z.string().trim().default(""),
  addOns: z.array(addOnInputSchema).default([]),
});

/** One-off custom line — free-text item name instead of a catalog product. */
export const customLineInputSchema = z.object({
  name: z.string().trim().min(1, "Custom line item name is required").max(500),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(9_999_999),
  description: z.string().trim().default(""),
});

export const quoteInputSchema = z
  .object({
    /** Existing client to link; null means "create a new client from the fields below". */
    clientId: z.string().trim().min(1).nullable().default(null),
    dealDate: dateString,
    salesRep: z.string().trim().default(""),
    market: z.string().trim().default(""),
    usState: z
      .string()
      .trim()
      .max(100)
      .default("")
      .transform((value) => normalizeUsState(value)),
    shipToLine1: z.string().trim().max(500).default(""),
    shipToLine2: z.string().trim().max(500).default(""),
    shipToCity: z.string().trim().max(200).default(""),
    shipToZip: z.string().trim().max(20).default(""),
    socketType: z.string().trim().max(100).default(""),
    targetDeliveryDate: optionalDateString,
    deliveryType: z.enum(DELIVERY_TYPE_OPTIONS, { message: "Delivery type is required" }),
    clientName: z.string().trim().min(1, "Client name is required"),
    registeredAddress: z.string().trim().default(""),
    website: z.string().trim().default(""),
    assemblyAddress: z.string().trim().default(""),
    clientPo: z.string().trim().default(""),
    actualClient: z.string().trim().default(""),
    vatNumber: z.string().trim().default(""),
    clientType: z.enum(["DIRECT", "AGENCY", "COWORKING"]),
    currency: z.enum(QUOTE_CURRENCIES).default("EUR"),
    isVip: z.boolean().default(false),
    paymentTerms: z.enum(["UPFRONT_100", "SPLIT_50_50", "NET_30"]),
    notes: z.string().trim().default(""),
    contacts: z.array(contactInputSchema).min(1, "Add at least one contact"),
    lineItems: z.array(lineItemInputSchema).default([]),
    standaloneAddOns: z.array(addOnInputSchema).default([]),
    customLines: z.array(customLineInputSchema).default([]),
  })
  .refine(
    (input) =>
      input.lineItems.length + input.standaloneAddOns.length + input.customLines.length > 0,
    { message: "Add at least one line item" },
  )
  .refine(
    (input) => {
      if (input.market.trim().toUpperCase() !== "US") return true;
      return (
        input.shipToLine1.trim().length > 0 &&
        input.shipToCity.trim().length > 0 &&
        input.usState.trim().length > 0 &&
        input.shipToZip.trim().length > 0
      );
    },
    {
      message: "US ship-to address (line 1, city, state, ZIP) is required for US market quotes",
    },
  )
  .refine(
    (input) => {
      if (input.market.trim().toUpperCase() !== "US") return true;
      return normalizeZampZip(input.shipToZip) !== null;
    },
    {
      message: "US ship-to ZIP must be 5 digits (or ZIP+4, e.g. 90210 or 90210-1234)",
    },
  );

/** Fields required for a live Zamp US tax estimate — not the full quote form. */
export const usTaxEstimateInputSchema = z
  .object({
    dealDate: dateString,
    market: z.string().trim().default(""),
    usState: z
      .string()
      .trim()
      .max(100)
      .default("")
      .transform((value) => normalizeUsState(value)),
    shipToLine1: z.string().trim().max(500).default(""),
    shipToLine2: z.string().trim().max(500).default(""),
    shipToCity: z.string().trim().max(200).default(""),
    shipToZip: z.string().trim().max(20).default(""),
    currency: z.enum(QUOTE_CURRENCIES).default("EUR"),
    lineItems: z.array(lineItemInputSchema).default([]),
    standaloneAddOns: z.array(addOnInputSchema).default([]),
    customLines: z.array(customLineInputSchema).default([]),
  })
  .refine(
    (input) =>
      input.lineItems.length + input.standaloneAddOns.length + input.customLines.length > 0,
    { message: "Add at least one line item" },
  )
  .refine(
    (input) => {
      if (input.market.trim().toUpperCase() !== "US") return true;
      return (
        input.shipToLine1.trim().length > 0 &&
        input.shipToCity.trim().length > 0 &&
        input.usState.trim().length > 0 &&
        input.shipToZip.trim().length > 0
      );
    },
    {
      message: "US ship-to address (line 1, city, state, ZIP) is required for US market quotes",
    },
  )
  .refine(
    (input) => {
      if (input.market.trim().toUpperCase() !== "US") return true;
      return normalizeZampZip(input.shipToZip) !== null;
    },
    {
      message: "US ship-to ZIP must be 5 digits (or ZIP+4, e.g. 90210 or 90210-1234)",
    },
  );

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type UsTaxEstimateInput = z.infer<typeof usTaxEstimateInputSchema>;

export const convertInputSchema = z.object({
  dealId: z
    .string()
    .trim()
    .min(1, "DealID is required")
    .max(64, "DealID is too long"),
  paymentPoDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .nullable()
    .optional(),
});
