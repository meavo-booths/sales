# Domain reference — meavo-sales

Business rules and **where to change what**. For stack see [architecture.md](architecture.md). For tables see [data-model.md](data-model.md).

## Glossary

| Term | Meaning |
|------|---------|
| Quote | A `Deal` row with `stage = QUOTE`; gets an automatic quote number `MQ-00001`, … from the `"SalesQuoteNumberSeq"` Postgres sequence |
| DealID | Manually entered business key assigned at conversion — the cross-app key shared with the Assembly tool and the Ops File (distinct from the `Deal.id` cuid) |
| FUCK YEAH | The conversion button/flow (`src/components/convert-quote.tsx` → `convertQuoteAction`): quote → won deal |
| BoothUnit | One row per physical booth on a won deal (status starts `PLANNED`), keyed by DealID for future manufacturing/logistics tools |
| Ops File | The team's Google Sheets operations spreadsheet; won deals are appended as rows `XXXX`, `XXXXa`, `XXXXb`, … grouped by model + finish |
| Line item | `QuoteLineItem` — a product (booth or add-on) or a custom one-off line; add-ons nest under a parent booth line via `parentLineItemId` |
| Market | Client market (UK, Germany, …) — drives VAT rate, product availability, and Xero theme/tax/account mappings |
| Custom Connection | Xero OAuth2 client-credentials app used for invoicing and product import |

## Status / state values

**`DealStage`:** `QUOTE` → `WON` (via conversion, irreversible) or `QUOTE` → `LOST` (`markQuoteLostAction`, requires a lost reason). Only `QUOTE`-stage deals are editable as quotes.

**`LostReason`:** `PROJECT_CANCELLED` · `CHOSE_COMPETITOR` · `PRICE_TOO_HIGH` · `NO_REPLY` · `OTHER` (with free-text `lostReasonNote`).

**`BoothUnitStatus`:** starts `PLANNED` at conversion; later stages belong to downstream tools.

**`PaymentStatus`:** on won deals, edited via `updatePaymentAction` until the first Xero payment sync (`xeroPaymentSyncedAt`); then synced from linked Xero invoice(s) every 15 minutes (cron) or on demand via **Refresh from Xero**.

**Sync states on `Deal`:** `sheetRows`/`sheetSyncedAt`/`sheetSyncError` (Ops File) and `xeroInvoiceId`/`xeroSyncError` (Xero). Error set ⇒ deal page shows badge + retry button; conversion itself is never blocked.

## Roles / personas

Access is granted per-user in gateway Admin via `ToolCardAccess` for the Sales tool card.

| Role | Route or scope | Permissions |
|------|----------------|-------------|
| Sales user (any user with `ToolCardAccess` for `SALES_TOOL_CARD_ID`) | All pages except Xero settings | Full quote/deal/client/product CRUD, conversion, retries |
| Admin (`User.systemRole === "ADMIN"`, plus tool access) | `/settings/xero` | Everything above + Xero mappings, setup confirmation, product sync |

Resolved in `src/lib/meavo-auth.ts` (`requireSalesAccess`, `requireSalesAdmin`); login-time gate in `src/lib/auth.ts` signIn callback.

## Mutation map

| Change | Domain module | Action / API | Notes |
|--------|---------------|--------------|-------|
| Create/edit/delete quote | `src/lib/quote-input.ts`, `src/lib/quote-number.ts` | `createQuoteAction` / `updateQuoteAction` / `deleteQuoteAction` (`src/app/actions/quotes.ts`) | Number from sequence on create; only `stage = QUOTE` editable |
| Convert quote → won deal | `src/lib/ops-sheet-export.ts`, `src/lib/xero/export-deal.ts` | `convertQuoteAction` (`src/app/actions/deals.ts`) | Assigns DealID, creates BoothUnits, then Ops + Xero exports (never throw) |
| Validate DealID before convert | — | `checkDealIdAction` | Uniqueness + existing `Assembly` check |
| Mark quote lost | `src/lib/deal-values.ts` | `markQuoteLostAction` | Requires `lostReason` (+ `lostReasonNote` when Other) |
| Edit won deal (payment, details, assembly, contacts, ready flag) | `src/lib/deal-values.ts`, `src/lib/client-contacts.ts` | `updatePaymentAction`, `updateDealDetailsAction`, `updateDealAssemblyAndNotesAction`, `updateDealContactsAction`, `updateDealReadyAction` | |
| Edit booth unit | — | `updateBoothUnitAction` | |
| Retry Ops File sync | `src/lib/ops-sheet-export.ts` | `retryOpsSheetSyncAction` | Idempotent — safe to re-run |
| Retry Xero invoice | `src/lib/xero/export-deal.ts` | `retryXeroInvoiceAction` (`src/app/actions/xero.ts`) | |
| Client create/edit + hierarchy | `src/lib/client-input.ts`, `src/lib/client-hierarchy.ts` | `createClientAction` / `updateClientAction` (`src/app/actions/clients.ts`) | Parent/subsidiary rules in client-hierarchy |
| Product create/edit | `src/lib/product-availability.ts` | `createProductAction` / `updateProductAction` (`src/app/actions/products.ts`) | Images → Vercel Blob |
| Xero mappings / setup confirm / product sync | `src/lib/xero/settings.ts`, `src/lib/xero/import-items.ts` | `saveXeroMappingsAction`, `confirmXeroSetupAction`, `syncProductsFromXeroAction` | Admin-only; editing mappings clears setup confirmation |
| FX rate lookup | `src/lib/exchange-rates.ts` | `getFxRateToEurAction` (`src/app/actions/fx.ts`) | Frankfurter API |
| VAT number check | — | `checkVatAction` (`src/app/actions/vat.ts`) | VIES |

## Authorization

- Resolved in: `src/lib/meavo-auth.ts` (page/action gates), `src/lib/auth.ts` (login gate), `src/app/api/quotes/[id]/pdf/route.ts` (route-level check).
- Key rules agents get wrong without docs:
  - Every Server Action re-checks `ToolCardAccess` from the DB — do not rely on the session alone; revocation must be immediate.
  - Xero settings actions require `requireSalesAdmin()`, not just access.
  - Ops File / Xero failures must never fail the conversion — persist the error on the `Deal` and let the user retry.
  - VAT is market-based display math (`src/lib/vat.ts`: UK 20%, Germany 19%, others 0%) — stored amounts are always excl. VAT.
  - Xero product import is one-way and only touches commercial fields; Sales owns kind, families, images, availability, add-on restrictions.
