# Contributing — meavo-sales

## Before you open a PR

- [ ] Changes are scoped to the request — no drive-by refactors
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No test suite — run the relevant DB smoke script (`npx tsx --env-file=.env scripts/smoke-test.ts` or a `scripts/*-check.ts`) and note the manual check in the PR
- [ ] Agent docs (`AGENTS.md`, `docs/`, `.cursor/rules/`) updated if you added routes, domain modules, or auth rules
- [ ] Writes that must reach the Ops File / Xero go through `exportDealToOpsSheet()` / `exportDealToXero()` non-blocking, with errors persisted on the `Deal`
- [ ] New pages verified at 375px and 1280px widths

## Branch naming

`feature/short-description`, `fix/short-description`, `docs/short-description`

## Commit messages

Imperative mood, complete sentences: "Add per-market Xero revenue account mapping".

## Code placement

| Layer | Location |
|-------|----------|
| Pages / UI | `src/app/(app)/`, components in `src/components/` (kit: `ui.tsx`) |
| Mutations | Server Actions in `src/app/actions/` |
| Business logic + validation | `src/lib/` (Zod schemas in `src/lib/*-input.ts`) |
| Integrations | `src/lib/ops-sheet-export.ts`, `src/lib/sheets-client.ts`, `src/lib/xero/` |

## Cross-repo dependencies

- `@meavo/db` — pinned git tag in `package.json` (`github:meavo-booths/meavo-db#vX.Y.Z`). Bump the ref, `npm install` (postinstall runs `prisma generate`).
- `@meavo/navigation` — pinned git tag; bump the same way. Transpiled via `next.config.ts`.

## Schema changes

Only in [meavo-db](https://github.com/meavo-booths/meavo-db) — change schema there, tag a release, bump the `@meavo/db` ref here, redeploy. Never `prisma db push` from this repo (shared DB — it can drop other apps' tables). Targeted DDL: add an idempotent file under `prisma/sql/` and apply with `npx prisma db execute --file prisma/sql/<file>.sql`.

## PR description

Include:

1. **What** changed (user-visible or API behaviour)
2. **Why** (link issue if any)
3. **How to verify** (commands or manual steps)
4. **Out of scope** (what you intentionally did not change)

## Agent-assisted PRs

If an AI agent wrote the code:

- Verify paths and business rules against `docs/domain.md`
- Reject leftover template placeholder comments in merged files
- Ensure no secrets in diff
