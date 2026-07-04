import { google, type sheets_v4 } from "googleapis";

/** Ops File tab that gateway imports (row 1 = headers, DealID column). */
export const OPS_SHEET_TAB = process.env.OPS_SHEET_TAB_NAME ?? "Sheet1";

export function isOpsSheetConfigured(): boolean {
  return Boolean(
    process.env.OPS_SHEET_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
}

export function getOpsSpreadsheetId(): string {
  const id = process.env.OPS_SHEET_SPREADSHEET_ID;
  if (!id) throw new Error("OPS_SHEET_SPREADSHEET_ID is not set");
  return id;
}

/**
 * Shared Sheets client with the read/write scope. The Ops File must be shared
 * with the service account as an Editor for writes to succeed.
 */
export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(json) as {
    client_email: string;
    private_key: string;
  };

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export function columnLetter(index: number): string {
  let letter = "";
  let value = index;
  while (value >= 0) {
    letter = String.fromCharCode((value % 26) + 65) + letter;
    value = Math.floor(value / 26) - 1;
  }
  return letter;
}
