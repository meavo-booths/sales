import { google } from "googleapis";

/**
 * Diagnostic: lists tab names of the configured spreadsheet and whether the
 * service account can write. Prints no credential material.
 * Run with: npx tsx --env-file=.env scripts/check-ops-sheet.ts
 */
async function main() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.OPS_SHEET_SPREADSHEET_ID;
  if (!json || !spreadsheetId) {
    console.log("GOOGLE_SERVICE_ACCOUNT_JSON or OPS_SHEET_SPREADSHEET_ID not set");
    return;
  }

  const credentials = JSON.parse(json) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets(properties(title))" });
  console.log("spreadsheet title:", meta.data.properties?.title);
  console.log("tabs:", (meta.data.sheets ?? []).map((s) => s.properties?.title).join(", "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
