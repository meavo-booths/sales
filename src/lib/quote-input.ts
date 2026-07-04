import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const contactInputSchema = z.object({
  kind: z.enum(["MAIN", "FINANCE"]),
  name: z.string().trim().min(1, "Contact name is required"),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  role: z.string().trim().default(""),
});

export const lineItemInputSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0).max(9_999_999),
  finish: z.enum(["CUSTOM", "WHITE_STOCK", "BLACK_STOCK", "LDF_COLOUR"]),
  finishDetails: z.string().trim().default(""),
  description: z.string().trim().default(""),
});

export const quoteInputSchema = z.object({
  dealDate: dateString,
  salesRep: z.string().trim().default(""),
  market: z.string().trim().default(""),
  clientName: z.string().trim().min(1, "Client name is required"),
  registeredAddress: z.string().trim().default(""),
  vatNumber: z.string().trim().default(""),
  clientType: z.enum(["DIRECT", "AGENCY", "COWORKING"]),
  paymentTerms: z.enum(["UPFRONT_100", "SPLIT_50_50", "NET_30"]),
  notes: z.string().trim().default(""),
  contacts: z.array(contactInputSchema).min(1, "Add at least one contact"),
  lineItems: z.array(lineItemInputSchema).min(1, "Add at least one line item"),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

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
