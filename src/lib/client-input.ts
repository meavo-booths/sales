import { z } from "zod";
import { contactInputSchema } from "@/lib/quote-input";

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  registeredAddress: z.string().trim().default(""),
  vatNumber: z.string().trim().default(""),
  clientType: z.enum(["DIRECT", "AGENCY", "COWORKING"]),
  market: z.string().trim().default(""),
  website: z.string().trim().default(""),
  isVip: z.boolean().default(false),
  parentClientId: z.string().trim().nullable().optional(),
  /** UI-only on create: group head with no billing fields required. */
  isGroupAccount: z.boolean().default(false),
  contacts: z.array(contactInputSchema).default([]),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
