# Data model — meavo-sales

Canonical schema lives in [meavo-db](https://github.com/meavo-booths/meavo-db) (`prisma/schema.prisma`), consumed here as the `@meavo/db` package. Sales-owned models sit under the `// ---- Sales (owner: sales) ----` and `// ---- Xero integration (owner: sales) ----` schema sections.

Local reference: `node_modules/@meavo/db/prisma/schema.prisma`

**Do not edit schema in this repo** — meavo-db is the owner. Workflow: change schema in meavo-db → tag release → bump the `@meavo/db` git ref in `package.json` → `npm install` (runs `prisma generate`). `db:push` is disabled here because the DB is shared; targeted DDL goes in idempotent `prisma/sql/*.sql` applied with `prisma db execute`.

Pinned version: `@meavo/db` `github:meavo-booths/meavo-db#v0.13.0` (see `package.json`).

## Entity relationship

```
Client ─┬─< ClientContact
        ├─< Client (parent/subsidiaries)
        └─< Deal ─┬─< DealContact
                  ├─< QuoteLineItem >─ Product (optional; add-ons nest via parentLineItemId)
                  ├─< BoothUnit >─ Product          (linked by Deal.dealId business key)
                  └─── Assembly (read-only, owner: assembly — matched on dealId)

Product ─┬─< ProductAvailability            (market × clientType)
         └─< ProductAddOnFamilyRestriction  (add-on → allowed booth families)

XeroMarketThemeMapping / XeroMarketTaxMapping / XeroMarketAccountMapping   (keyed by market)
XeroIntegrationSettings                                                    (singleton id = "xero")

Shared (owner: gateway): User, Account, ToolCard, ToolCardAccess
```

## Core tables / models

### `Deal`

One row per quote **and** per deal — there is no separate Quote model; `stage` distinguishes them.

| Field | Notes |
|-------|-------|
| `quoteNumber` | Unique, `MQ-00001` format from Postgres sequence `"SalesQuoteNumberSeq"` |
| `stage` | `QUOTE` → `WON` / `LOST` (`DealStage`) |
| `lostReason` / `lostReasonNote` | Set when marking LOST (`LostReason` enum; note for Other) |
| `dealId` | Business key entered at conversion; cross-app key for Assembly + Ops File; distinct from cuid `id` |
| `clientId` + snapshot fields | FK to `Client` plus denormalized client name/market/etc. captured at quote time |
| `currency`, `exchangeRateToEur` | Multi-currency quotes (EUR/GBP/CZK/USD); EUR amounts kept for reporting |
| `paymentStatus`, `paymentTerms` | Won-deal payment tracking; terms drive Xero due date |
| `readyToAssemble`, `assemblyAddress` | Assembly handoff fields |
| `sheetRows`, `sheetSyncedAt`, `sheetSyncError` | Ops File sync state (rows written, idempotency, retry) |
| `xeroInvoiceId`, `xeroSyncError` | Xero invoice sync state |

### `QuoteLineItem`

| Field | Notes |
|-------|-------|
| `productId` | Optional — null for custom one-off lines (`customName`) |
| `quantity`, `unitPrice`, `unitPriceEur` | Always excl. VAT; EUR copy for reporting/Ops |
| `finish` | `ProductFinish` — part of the Ops File model+finish grouping key |
| `parentLineItemId` | Self-relation: add-on lines nest under a booth line |

### `BoothUnit`

One per physical booth, created at conversion with status `PLANNED`; consumed by future manufacturing/logistics tools.

| Field | Notes |
|-------|-------|
| `dealId` | The business DealID (not the Deal cuid) |
| `productId`, `finish`, `location` | Booth model, finish, placement |
| `status` | `BoothUnitStatus`, default `PLANNED` |

### `Client` / `ClientContact`

Client directory with parent/subsidiary hierarchy (`parentClientId`), `market`, `clientType`, `isVip`, `vatNumber`, cached `xeroContactId`. Contacts have `kind` `MAIN` / `FINANCE` / `ASSEMBLY` (mirrored per-deal as `DealContact`).

### `Product` (+ `ProductAvailability`, `ProductAddOnFamilyRestriction`)

Catalog of booths and add-ons (`kind`), with `boothFamily`/`addOnFamily`, `listPrice`, per-product `currency`, image, `isActive`, and Xero linkage (`xeroItemId`/`xeroItemCode`). Availability is market × clientType; add-on restrictions limit which booth families an add-on may attach to. Xero sync owns only name/description/price/active.

### Xero mapping tables

`XeroMarketThemeMapping`, `XeroMarketTaxMapping`, `XeroMarketAccountMapping` (one row per market) and singleton `XeroIntegrationSettings` (`setupConfirmedAt` gates auto-invoicing, plus defaults).

### Shared models (read / FK only — owner: gateway)

`User` (auth + `systemRole` admin check), `Account` (Google OAuth), `ToolCard` / `ToolCardAccess` (access gating). `Assembly` (owner: assembly) is read to check DealID linkage. This app does **not** write `NotificationOutbox`.

## Sync / external copies

- **Ops File (Google Sheets)** — won deals appended as one row per model+finish group (`XXXX`, `XXXXa`, …) with booth counts and value shares; written row refs stored in `Deal.sheetRows` for idempotent retry (`src/lib/ops-sheet-export.ts`). The gateway sheet import reads the same file.
- **Xero** — draft `ACCREC` invoice per won deal (`Deal.xeroInvoiceId`); contacts cached on `Client.xeroContactId`; products imported one-way from Xero Items by item code.

## Queries agents should reuse

- `src/lib/prisma.ts` — the singleton PrismaClient; never instantiate another.
- `src/lib/quote-number.ts` — the only sanctioned raw SQL (`nextval('"SalesQuoteNumberSeq"')`).
- `src/lib/client-hierarchy.ts` — parent/subsidiary traversal and quote-selectable client rules.
- `src/lib/product-availability.ts` — market × clientType availability checks.
- `src/lib/deal-values.ts` — enum labels and money/date formatters; don't re-derive.
