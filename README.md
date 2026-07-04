# MEAVO Sales

Quotes → deals tool for the sales team. Quotes get an automatic number (`MQ-00001`, …); the
**FUCK YEAH** button converts a quote into a won deal under a manually entered DealID — the same
cross-app key used by the Assembly tool and the Ops File. Winning a deal creates one `BoothUnit`
per booth (status `PLANNED`) for the future manufacturing and logistics tools, and appends the
deal to the Ops File using the existing multi-row convention (`XXXX`, `XXXXa`, …).

## Local setup

```bash
cp .env.example .env
# Same DATABASE_URL as meavo-gateway

npm install
npx prisma db execute --file prisma/sql/sales_tool.sql   # targeted migration (shared DB!)
npm run db:seed                                           # booth model products + quote sequence
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

> **Shared DB warning:** never run a bare `prisma db push` if this repo's schema is behind the
> other apps (gateway / assembly / hols) — Prisma may try to drop their tables. Use the targeted
> SQL script in `prisma/sql/`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Shared Neon Postgres (same as gateway) |
| `AUTH_SECRET` | Session signing |
| `AUTH_URL` | `http://localhost:3002` / `https://sales.meavo.app` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google SSO for MEAVO team |
| `SALES_TOOL_CARD_ID` | `seed-sales-tool` (gateway tool card that gates login) |
| `GATEWAY_URL` / `MEAVO_APP_KEY` | Shared nav / tool switcher (`sales`) |
| `OPS_SHEET_SPREADSHEET_ID` | Ops File spreadsheet (same one gateway imports) |
| `OPS_SHEET_TAB_NAME` | Ops File tab name |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON — needs **Editor** on the Ops File |
| `BLOB_READ_WRITE_TOKEN` | Product image uploads |
| `ASSEMBLY_URL` | Link target for the Assembly record on deal pages |

## Ops File write-back

When a quote is won, line items are grouped by model + finish and appended to the Ops File —
one row per group. The first row uses the plain DealID, later rows get letter suffixes
(`XXXXa`, `XXXXb`, …), matching how the team enters multi-model deals manually. Each row carries
that group's booth count and its share of the deal value, so existing booth/revenue reports and
the gateway sheet import keep working unchanged.

Columns are resolved from the sheet's header row with the same slugification as the gateway
import, so column order changes don't break the export. If the sync fails, the deal page shows a
badge with a retry button — conversion itself is never blocked.

## Deploy

1. New Vercel project from this repo
2. Same `DATABASE_URL` as gateway
3. Domain: `sales.meavo.app`
4. Apply `prisma/sql/sales_tool.sql` once against the shared DB, then `npm run db:seed`
5. In gateway Admin, create the Sales tool card (`seed-sales-tool`) and grant users access

## Related apps

| App | Domain | Repo |
|-----|--------|------|
| Sales | [sales.meavo.app](https://sales.meavo.app) | [meavo-booths/sales](https://github.com/meavo-booths/sales) |
| Gateway | [meavo.app](https://meavo.app) | [meavo-booths/meavo-gateway](https://github.com/meavo-booths/meavo-gateway) |
| Assembly | [assembly.meavo.app](https://assembly.meavo.app) | [meavo-booths/assembly](https://github.com/meavo-booths/assembly) |
| Vacation Tracker | [hols.meavo.app](https://hols.meavo.app) | [meavo-booths/hols](https://github.com/meavo-booths/hols) |
