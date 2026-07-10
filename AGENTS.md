# Agent guide — meavo-sales

Quick orientation for AI agents working in this repo. Read this before exploring blindly.

**Cursor:** `.cursor/rules/core.mdc` is always applied. See also `domain.mdc` and `api.mdc` when editing matching paths.

## What this repo does

Quotes → deals tool for the MEAVO sales team ([sales.meavo.app](https://sales.meavo.app)).
Quotes get an automatic number (`MQ-00001`, …); the **FUCK YEAH** button converts a quote into a
won deal under a manually entered DealID (the cross-app key shared with Assembly and the Ops File),
creates one `BoothUnit` per booth, appends rows to the Ops File (Google Sheets), and drafts a Xero
invoice. There is **no separate Quote model** — quotes are `Deal` rows with `stage = QUOTE`.

## Stack

- Next.js 15 App Router, TypeScript strict, React 19, Tailwind CSS 3 (in-house UI kit, no external component lib)
- Prisma 6 via `@meavo/db` (pinned git tag) → shared Neon Postgres — schema lives in [meavo-db](https://github.com/meavo-booths/meavo-db), **not here**
- NextAuth v5 (JWT), Google SSO only (invite-only), gated on `ToolCardAccess` for `SALES_TOOL_CARD_ID`
- `@meavo/navigation` shared top nav; Vercel hosting; Vercel Blob (product images)
- Integrations: Google Sheets (Ops File write-back), Xero Custom Connection (invoices + product import), Frankfurter FX, VIES VAT, `@react-pdf/renderer` (quote PDFs)

## First files to read

| Task | Start here |
|------|------------|
| Quote create/edit form & validation | `src/components/quote-form.tsx`, `src/lib/quote-input.ts`, `src/app/actions/quotes.ts` |
| Deal conversion (FUCK YEAH) / won-deal edits | `src/app/actions/deals.ts`, `src/components/convert-quote.tsx`, `src/components/deal-editors.tsx` |
| Ops File (Google Sheets) write-back | `src/lib/ops-sheet-export.ts`, `src/lib/sheets-client.ts` |
| Xero invoicing on win | `src/lib/xero/export-deal.ts`, `src/lib/xero/settings.ts`, `src/lib/xero/client.ts` |
| Xero product sync / admin settings | `src/lib/xero/import-items.ts`, `src/app/actions/xero.ts`, `src/components/xero-setup.tsx` |
| VAT rates, totals, VIES check | `src/lib/vat.ts`, `src/app/actions/vat.ts` |
| Quote PDF | `src/lib/quote-pdf.tsx`, `src/app/api/quotes/[id]/pdf/route.ts` |
| Products, images, availability | `src/app/actions/products.ts`, `src/components/product-forms.tsx`, `src/lib/product-availability.ts` |
| Clients directory & hierarchy | `src/app/actions/clients.ts`, `src/lib/client-hierarchy.ts`, `src/lib/client-contacts.ts` |
| Quote numbering (`MQ-xxxxx`) | `src/lib/quote-number.ts`, `src/lib/constants.ts` |
| Auth & access | `src/lib/meavo-auth.ts`, `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts` |
| DB schema | `node_modules/@meavo/db/prisma/schema.prisma` (read-only — change in meavo-db) |
| Tests | No test suite — DB smoke scripts: `npx tsx --env-file=.env scripts/smoke-test.ts` (and `scripts/*-check.ts`) |

## Do NOT

- Edit the Prisma schema in this repo — it lives in meavo-db; bump the `@meavo/db` git ref instead
- Run `prisma db push` — disabled; shared DB, a stale schema can drop other apps' tables. Targeted changes go through idempotent `prisma/sql/*.sql` + `prisma db execute`
- Block quote → deal conversion on Ops File or Xero failures — `exportDealToOpsSheet` / `exportDealToXero` never throw; they store the error on the `Deal` and the UI surfaces a retry button
- Look up the tool card by `linkedAppKey` at runtime — always use `SALES_TOOL_CARD_ID` (`seed-sales-tool`)
- Add shadcn / Radix / MUI or any external component library — use `src/components/ui.tsx`
- Let Xero product import overwrite Sales-owned fields (kind, families, images, availability, add-on restrictions) — Xero owns only name, description, list price, active state
- Create a separate Quote model or table — quotes are `Deal` rows with `stage = QUOTE`
- Commit secrets or `.env`; document env var names in `.env.example` only

## Commands

```bash
npm install
npm run dev        # http://localhost:3002
npm run lint
npm run build
npx tsx --env-file=.env scripts/smoke-test.ts   # DB smoke test (needs DATABASE_URL)
```

## Conventions

1. Domain logic in `src/lib/` (Xero under `src/lib/xero/`) — keep pages and actions thin; validate with Zod schemas in `src/lib/*-input.ts`.
2. Mutations are Server Actions in `src/app/actions/` returning `{ ok: true, ... } | { ok: false, error }` (products use `{ error?, success? }` for `useActionState`); call `revalidatePath()` after writes.
3. Every authenticated page/action calls `requireSalesAccess()` (admin: `requireSalesAdmin()`) from `src/lib/meavo-auth.ts`; middleware only redirects pages, never protects `/api/*`.
4. External side effects after a win (Ops File, Xero) never throw — errors are persisted on the deal for retry, so conversion always succeeds.

## Scoped task template (preferred from user)

```
Area/route: <!-- e.g. /quotes/new or /deals/[id] -->
Behaviour: [what should happen]
Reference: [legacy file or doc, if any]
Out of scope: [auth / other packages / etc.]
```

## Related docs

- [docs/architecture.md](docs/architecture.md) — stack, layout, data flow
- [docs/domain.md](docs/domain.md) — business rules, personas, mutation map
- [docs/data-model.md](docs/data-model.md) — database tables
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR process
