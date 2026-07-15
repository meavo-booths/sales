# Architecture — meavo-sales

Quotes → deals tool for the MEAVO sales team, deployed at [sales.meavo.app](https://sales.meavo.app).
Satellite app in the meavo-booths ecosystem: it shares one Neon Postgres database with the other
apps, reads shared identity tables (gateway-owned), and writes only its own Sales domain tables.

**Further reading:**
- [domain.md](domain.md) — business rules, personas, mutation map
- [data-model.md](data-model.md) — database tables
- [AGENTS.md](../AGENTS.md) — quick orientation for AI agents

## Sibling repos (meavo-booths)

| Repo | Relationship |
|------|----------------|
| [meavo-db](https://github.com/meavo-booths/meavo-db) | Owns the canonical Prisma schema; consumed here as `@meavo/db` (pinned git tag) |
| [meavo-gateway](https://github.com/meavo-booths/meavo-gateway) | Owns Users, ToolCards, `ToolCardAccess`; admins grant Sales access there. Also imports the Ops File sheet this app appends to |
| [meavo-navigation](https://github.com/meavo-booths/meavo-navigation) | Shared top nav + tool switcher (`src/components/nav.tsx`) |
| [assembly](https://github.com/meavo-booths/assembly) | Consumes the DealID business key; deal pages link to the Assembly record via `ASSEMBLY_URL`; `checkDealIdAction` checks for an existing `Assembly` row |

## Stack decisions

- **Next.js 15 App Router + React 19 + TypeScript strict** — org standard for new apps; single repo, no separate backend.
- **Prisma 6 via `@meavo/db`** — `package.json` points Prisma at `node_modules/@meavo/db/prisma/schema.prisma`; `db:push` is disabled because the DB is shared (a stale schema could drop other apps' tables). Targeted DDL ships as idempotent `prisma/sql/*.sql` applied with `prisma db execute`.
- **NextAuth v5, Google SSO only** — invite-only (user must exist in the shared `User` table) and gated on `ToolCardAccess` for `SALES_TOOL_CARD_ID` at login and on every request.
- **Vercel** hosting; **Vercel Blob** for product images; **Tailwind 3** with the in-house UI kit (no external component library).
- **Xero Custom Connection** (OAuth2 client credentials) rather than a partner app — single org, server-to-server.

## Repository layout

```
src/
  app/
    (app)/            # authenticated route group: /, deals, clients, products, quotes, settings/xero
    login/            # public login (Google SSO)
    actions/          # Server Actions — all mutations (quotes, deals, clients, products, xero, fx, vat, auth)
    api/
      auth/[...nextauth]/   # NextAuth handlers
      quotes/[id]/pdf/      # quote PDF download (auth-checked route handler)
  components/         # ui.tsx kit, nav.tsx (@meavo/navigation), forms, modals, deal editors
  lib/                # domain logic: quote-number, vat, ops-sheet-export, client-hierarchy, ...
    xero/             # Xero client, settings/mappings, export-deal, import-items
  middleware.ts       # session redirect for pages (passes /api/* through)
  types/next-auth.d.ts
prisma/
  seed.ts             # quote sequence + booth model products
  sql/                # idempotent targeted migrations for the shared DB
scripts/              # seed-tool-card, smoke-test, diagnostics, one-off backfills
```

## Data flow

```
Browser
  → src/middleware.ts            (no session → /login; pages only)
  → (app) page                   (requireSalesAccess(); admin pages: requireSalesAdmin())
  → Server Action                (Zod validate → Prisma write → revalidatePath)

Quote conversion (FUCK YEAH), inside convertQuoteAction:
  Deal.stage QUOTE → WON, dealId assigned        (transactional)
  BoothUnit created per booth line, status PLANNED
  then (exports never throw — errors persisted on Deal + retry buttons):
    ├─ exportDealToOpsSheet()  → Google Sheets append (rows XXXX, XXXXa, …)
    └─ exportDealToXero()      → draft ACCREC invoice (contact find-or-create,
                                  per-market theme/tax/account mappings)
```

External reads: Frankfurter API (FX rate to EUR when quoting), VIES (on-demand VAT number check),
Xero Items (one-way product import by item code, Sales-owned fields preserved).

## API surface

- **Server Actions** (`src/app/actions/`) — the mutation pattern for everything: quotes CRUD, conversion, won-deal edits, clients, products (with Blob upload), Xero settings/sync/retry, FX and VAT lookups.
- **REST**: `GET /api/quotes/[id]/pdf` (streams the quote PDF; own auth + `ToolCardAccess` check) and `GET|POST /api/auth/[...nextauth]`.
- No webhooks.
- **Cron:** `GET /api/cron/sync-xero-payments` every 15 minutes — polls Xero invoice payment state into `Deal.paymentStatus` (requires `CRON_SECRET`).

## Scheduled jobs

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/sync-xero-payments` | `*/15 * * * *` | Sync payment status from linked Xero invoices on won deals |

## Environment variables

Document names only (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Shared Neon Postgres (same as gateway) |
| `AUTH_SECRET` / `AUTH_URL` | NextAuth session signing / canonical URL |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google SSO |
| `SALES_TOOL_CARD_ID` | Tool card gating login + every request (`seed-sales-tool`) |
| `GATEWAY_URL` / `MEAVO_APP_KEY` | `@meavo/navigation` shared nav / tool switcher (`sales`) |
| `OPS_SHEET_SPREADSHEET_ID` / `OPS_SHEET_TAB_NAME` | Ops File target |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Sheets service account (Editor on the Ops File) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob product images |
| `ASSEMBLY_URL` | Link target for Assembly records on deal pages |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Xero Custom Connection (client credentials) |
| `XERO_SALES_ACCOUNT_CODE` | Optional last-resort revenue account code |
| `CRON_SECRET` | Bearer token for `/api/cron/*` (Xero payment sync) |

## Deployment

Vercel project from this repo, domain `sales.meavo.app`, port 3002 locally. First deploy:
apply `prisma/sql/sales_tool.sql` once against the shared DB, run `npm run db:seed`, then create
the Sales tool card in gateway Admin (`scripts/seed-tool-card.ts` seeds `seed-sales-tool`) and
grant users access. Schema updates arrive by bumping the `@meavo/db` git ref and redeploying.
