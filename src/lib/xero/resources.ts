import { xeroFetch } from "@/lib/xero/client";

export type XeroBrandingTheme = {
  BrandingThemeID: string;
  Name: string;
  /** The org default theme has SortOrder 0. */
  SortOrder: number;
};

export type XeroTaxRate = {
  Name: string;
  TaxType: string;
  Status: string;
  /** Effective percentage, e.g. 20 for UK standard rate. */
  EffectiveRate: number;
  CanApplyToRevenue: boolean;
};

export type XeroItem = {
  ItemID: string;
  Code: string;
  Name?: string;
  Description?: string;
  IsSold: boolean;
  SalesDetails?: { UnitPrice?: number; AccountCode?: string };
  UpdatedDateUTC?: string;
};

export type XeroAccount = {
  AccountID: string;
  Code?: string;
  Name: string;
  Status: string;
  /** Account class, e.g. REVENUE. Xero's "Sales" type accounts are class REVENUE. */
  Class?: string;
};

export type XeroContact = {
  ContactID: string;
  Name: string;
};

export async function listBrandingThemes(): Promise<XeroBrandingTheme[]> {
  const data = await xeroFetch<{ BrandingThemes: XeroBrandingTheme[] }>("/BrandingThemes");
  return data.BrandingThemes ?? [];
}

export async function listRevenueTaxRates(): Promise<XeroTaxRate[]> {
  const data = await xeroFetch<{ TaxRates: XeroTaxRate[] }>("/TaxRates");
  return (data.TaxRates ?? []).filter((rate) => rate.Status === "ACTIVE" && rate.CanApplyToRevenue);
}

/** Active revenue accounts with a code — candidates for invoice line coding. */
export async function listRevenueAccounts(): Promise<XeroAccount[]> {
  const data = await xeroFetch<{ Accounts: XeroAccount[] }>("/Accounts");
  return (data.Accounts ?? []).filter(
    (account) => account.Status === "ACTIVE" && account.Class === "REVENUE" && account.Code,
  );
}

/** Active liability accounts with a code — candidates for US sales tax lines. */
export async function listTaxLiabilityAccounts(): Promise<XeroAccount[]> {
  const data = await xeroFetch<{ Accounts: XeroAccount[] }>("/Accounts");
  return (data.Accounts ?? []).filter(
    (account) => account.Status === "ACTIVE" && account.Class === "LIABILITY" && account.Code,
  );
}

export async function listItems(): Promise<XeroItem[]> {
  const data = await xeroFetch<{ Items: XeroItem[] }>("/Items");
  return data.Items ?? [];
}

/** Xero `where` clauses take C#-ish string literals; escape embedded quotes. */
function quoteForWhere(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

export async function findContactByName(name: string): Promise<XeroContact | null> {
  const where = encodeURIComponent(`Name==${quoteForWhere(name)}`);
  const data = await xeroFetch<{ Contacts?: XeroContact[] }>(`/Contacts?where=${where}`);
  return data.Contacts?.[0] ?? null;
}

export async function createContact(input: {
  name: string;
  email?: string;
  taxNumber?: string;
  address?: string;
}): Promise<XeroContact> {
  const data = await xeroFetch<{ Contacts: XeroContact[] }>("/Contacts", {
    method: "POST",
    body: {
      Contacts: [
        {
          Name: input.name,
          ...(input.email ? { EmailAddress: input.email } : {}),
          ...(input.taxNumber ? { TaxNumber: input.taxNumber } : {}),
          ...(input.address
            ? { Addresses: [{ AddressType: "POBOX", AddressLine1: input.address }] }
            : {}),
        },
      ],
    },
  });
  const contact = data.Contacts?.[0];
  if (!contact) throw new Error("Xero returned no contact");
  return contact;
}

export type XeroInvoiceLineItem = {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  DiscountRate?: number;
  TaxType?: string;
  AccountCode?: string;
  ItemCode?: string;
};

export type XeroInvoiceResult = {
  InvoiceID: string;
  InvoiceNumber: string;
};

export type XeroInvoicePayment = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Status: string;
  AmountPaid?: number;
  AmountDue?: number;
  FullyPaidOnDate?: string;
};

export async function getInvoice(invoiceId: string): Promise<XeroInvoicePayment> {
  const data = await xeroFetch<{ Invoices: XeroInvoicePayment[] }>(`/Invoices/${invoiceId}`);
  const invoice = data.Invoices?.[0];
  if (!invoice) throw new Error("Xero invoice not found");
  return invoice;
}

export async function createDraftInvoice(input: {
  contactId: string;
  date: string;
  dueDate: string;
  reference: string;
  currencyCode: string;
  brandingThemeId?: string;
  lineItems: XeroInvoiceLineItem[];
  idempotencyKey: string;
}): Promise<XeroInvoiceResult> {
  const data = await xeroFetch<{ Invoices: XeroInvoiceResult[] }>("/Invoices", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: {
      Invoices: [
        {
          Type: "ACCREC",
          Status: "DRAFT",
          Contact: { ContactID: input.contactId },
          Date: input.date,
          DueDate: input.dueDate,
          Reference: input.reference,
          CurrencyCode: input.currencyCode,
          LineAmountTypes: "Exclusive",
          ...(input.brandingThemeId ? { BrandingThemeID: input.brandingThemeId } : {}),
          LineItems: input.lineItems,
        },
      ],
    },
  });
  const invoice = data.Invoices?.[0];
  if (!invoice) throw new Error("Xero returned no invoice");
  return invoice;
}
