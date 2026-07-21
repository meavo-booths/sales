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
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Xero Custom Connection (client credentials) |
| `XERO_SALES_ACCOUNT_CODE` | Optional last-resort revenue account code; per-market accounts are configured in Settings → Xero |

## Ops File write-back

When a quote is won, line items are grouped by model + finish and appended to the Ops File —
one row per group. The first row uses the plain DealID, later rows get letter suffixes
(`XXXXa`, `XXXXb`, …), matching how the team enters multi-model deals manually. Each row carries
that group's booth count and its share of the deal value, so existing booth/revenue reports and
the gateway sheet import keep working unchanged.

Columns are resolved from the sheet's header row with the same slugification as the gateway
import, so column order changes don't break the export. If the sync fails, the deal page shows a
badge with a retry button — conversion itself is never blocked.

## Xero integration

Uses a Xero **Custom Connection** (OAuth2 client credentials, scopes
`accounting.invoices accounting.contacts accounting.settings.read`).

- **Invoicing** — winning a deal creates a DRAFT `ACCREC` invoice in Xero: contact is
  found-or-created by client name (cached on the Client), line items stay excl. VAT with the
  market's mapped tax type and post to the market's mapped revenue account, the invoice template
  comes from the market → branding theme mapping, and payment terms set the due date (Net 30 =
  +30 days). Failures never block conversion; the deal page shows the error with a retry button.
- **Setup gate** — auto-invoicing stays off until an admin reviews and confirms the market →
  branding theme, market → tax rate, and market → revenue account mappings under
  **Settings → Xero** (admin-only nav link). Editing mappings clears the confirmation.
- **Revenue accounts** — each market maps to a Xero revenue account (e.g. UK → `200 Sales UK`,
  Germany → `201 Sales DACH`); unmapped markets use the default account from the setup page, or
  `XERO_SALES_ACCOUNT_CODE` as a last resort. The mapped account is set explicitly on every
  invoice line, overriding any default account on the Xero item.
- **Product import** — “Sync from Xero” (Products page or Xero settings) imports Xero Items
  one-way by item code: Xero owns name, description, list price, and active state; kind,
  families, images, availability, and add-on restrictions stay Sales-owned. Items without an
  item code are skipped; items removed in Xero are deactivated, not deleted.
- **VAT on quotes** — market-based VAT (`src/lib/vat.ts`: UK 20%, Germany 19%, others 0%) adds
  Subtotal / VAT / Total (incl. VAT) rows to quote forms, deal pages, and the quote PDF.

Test against the free Xero Demo Company before pointing the credentials at the production org.

## Product CSV import

Admin-only **Import from CSV** on the Products page bulk-updates Sales-owned metadata for
products that already exist (match key: Xero **Item Code**). Run **Sync from Xero** first so
item codes are present.

Required columns: `Item Code`, `Item Name`, `Zamp Tax Code`, `Type`, `Product Family`
(required for booths only; leave empty for add-ons), `Currency`, `Market`, `Client Type`. One row per Item Code. Item Name is verified against the
existing product but not overwritten.

Availability expansion rules:

- Market `RoW` also adds `Balkans`
- Client Type `Both` → Direct, Agency, Coworking, Showroom, and Internal/Events
- Client Type `Agency` also adds Coworking

The import replaces each matched product’s availability rows and updates type, family, currency,
and Zamp tax code. Images, list price, description, and add-on booth-family restrictions are
not changed.

## Deleting deals and products

- **Won deals** — admins see **Delete deal** on the deal page. Removes the deal, quote lines,
  and booth units from the database. Xero invoices and Ops File rows are not removed from those
  external systems.
- **Products** — **Delete** on each product card removes unused catalogue entries. If a product
  is still on a quote or booth unit, deletion is blocked; use **Active** to hide it from new
  quotes instead.

## Deploy

1. New Vercel project from this repo
2. Same `DATABASE_URL` as gateway
3. Domain: `sales.meavo.app`
4. Apply `prisma/sql/sales_tool.sql` once against the shared DB, then `npm run db:seed`
5. In gateway Admin, create the Sales tool card (`seed-sales-tool`) and grant users access

## Documentation

| Doc | Contents |
|-----|----------|
| [AGENTS.md](AGENTS.md) | Quick orientation for AI agents — task → file map, hard rules, commands |
| [docs/architecture.md](docs/architecture.md) | Stack, sibling repos, repository layout, data flow, env vars, deploy |
| [docs/domain.md](docs/domain.md) | Business rules, glossary, roles, mutation map |
| [docs/data-model.md](docs/data-model.md) | Sales-owned Prisma models, sync state, schema-change workflow |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PR process, code placement, cross-repo dependency bumps |

## Related apps

| App | Domain | Repo |
|-----|--------|------|
| Sales | [sales.meavo.app](https://sales.meavo.app) | [meavo-booths/sales](https://github.com/meavo-booths/sales) |
| Gateway | [meavo.app](https://meavo.app) | [meavo-booths/meavo-gateway](https://github.com/meavo-booths/meavo-gateway) |
| Assembly | [assembly.meavo.app](https://assembly.meavo.app) | [meavo-booths/assembly](https://github.com/meavo-booths/assembly) |
| Vacation Tracker | [hols.meavo.app](https://hols.meavo.app) | [meavo-booths/hols](https://github.com/meavo-booths/hols) |
