# Admin Daily Inventory Implementation Review - 2026-07-22

## Purpose

Move the Legacy-style "daily stock and remaining quantity" workbench onto the Back Office first page while keeping ROS data ownership intact.

## Changed Files

- `src/web/admin/page.ts`
- `tests/e2e/catalog-publish-to-pos.spec.ts`

## What Changed

- `/admin` now shows `今日備貨與剩餘` as the first Back Office work area.
- It lists the selected current/draft Event inventory with:
  - product name
  - category
  - selling price
  - planned quantity
  - safety buffer quantity
  - customer available quantity
  - reserved quantity
  - sold quantity
  - active current order quantity
  - remaining quantity
- Draft Events can add published products and edit planned/safety quantities through the existing sellable inventory API.
- Non-draft Events are read-only in this UI because the existing business rule only permits sellable inventory changes while an Event is `draft`.
- Product category and product draft/publish management remain on the same Back Office page, below the daily inventory section.
- Details expansion shows customer-facing name/description and explicitly marks Cost/BOM as not enabled.
- The E2E catalog-to-POS test now waits for the existing `/api/admin/events/:eventId/open` response before navigating to POS, avoiding aborting the open request during test execution.

## What Did Not Change

- No SQLite schema change.
- No migration.
- No API endpoint change.
- No Domain or Contract change.
- No Product Contract change.
- No Event business rule change.
- No Order, Inventory, Payment, Customer, Preorder, Kiosk, LINE, Cost, BOM, AI, n8n, or Legacy changes.

## Data Ownership

- Catalog still owns product master and published product snapshots.
- Operations still owns Event and sellable inventory.
- Back Office is only an aggregated UI over existing Catalog and Operations APIs.

## Known Constraint

Live replenishment during an `open` Event is still blocked by the existing rule:

`Sellable inventory can only be changed while an event is draft.`

If the owner wants Legacy-style live stock adjustment during service, that requires a separate Architecture Decision because it changes Operations business rules.

## Verification

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm test`: PASS, 33 tests
- `pnpm architecture:guard`: PASS, 7 tests
- `pnpm migration:smoke`: PASS, migrations 001-009
- `pnpm test:e2e`: PASS, 10 tests
- `pnpm verify`: PASS
- `pnpm verify:full`: PASS

## Commits

- `70f190d test: wait for event open before POS catalog assertion`
- `307c414 feat: surface daily inventory on back office home`

