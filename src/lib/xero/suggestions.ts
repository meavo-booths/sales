import type { XeroAccount } from "@/lib/xero/resources";

/** Suggest a liability account for sales tax / VAT reference mapping. */
export function suggestTaxLiabilityAccount(accounts: XeroAccount[]): string {
  const match = accounts.find((account) =>
    /sales tax|tax payable|tax liability|vat/i.test(account.Name),
  );
  return match?.Code ?? accounts[0]?.Code ?? "";
}
