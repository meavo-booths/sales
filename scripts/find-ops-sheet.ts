import { google } from "googleapis";

/**
 * Diagnostic: lists spreadsheets shared with the service account so the Ops
 * File spreadsheet ID can be identified. Prints no credential material.
 */
async function main() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    console.log("GOOGLE_SERVICE_ACCOUNT_JSON not set");
    return;
  }

  const credentials = JSON.parse(json) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: "files(id,name,capabilities(canEdit))",
    pageSize: 50,
  });

  for (const file of res.data.files ?? []) {
    console.log(`${file.name} | ${file.id} | canEdit=${file.capabilities?.canEdit}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
