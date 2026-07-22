# Admin Daily Inventory Workbench Pre-Modification Audit

Date: 2026-07-22
Branch: feature/phase-b1-pos-operating-loop-completion
Purpose: prepare a safe review package for GPT / Claude before moving the Legacy-style "今日備貨與剩餘" workflow onto the Back Office first page.

## 1. User Intent

Architecture Owner wants the Back Office first page to behave like the Legacy "今日備貨與剩餘" page.

The daily operator flow is not "schedule future events and menus." It is:

1. Open Back Office.
2. See today's stock board immediately.
3. Adjust today's item setup.
4. Run POS / Kitchen.
5. Close the day and preserve the record.

The target UI should prioritize:

- 今日備貨與剩餘
- 新增品項
- 商品 row editing
- 備貨
- 預約
- 現場售出
- 目前訂單
- 剩餘
- 停用 / 恢復
- 展開客人介紹 / 食材明細
- 報廢處理
- 上次出攤紀錄

## 2. Existing Logic Inventory

### `/admin`

Route:

- `GET /admin`
- Renderer: `src/web/admin/page.ts`

Current purpose:

- Catalog category management
- Catalog product draft management
- Catalog publish action

Current state:

- `state.categories`
- `state.products`
- `state.selectedProductId`

Current APIs used:

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:categoryId`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:productId`
- `POST /api/admin/products/:productId/publish`

Data owner:

- Catalog.

Risk:

- This page currently knows nothing about Event inventory except links in navigation.
- If daily inventory is added carelessly, it may create duplicate local state beside the existing `/admin/events` state.

### `/admin/events`

Route:

- `GET /admin/events`
- Renderer: `src/web/events/page.ts`

Current purpose:

- Create / update event
- Select event
- Add published product into event inventory
- Set `plannedQuantity`
- Set `safetyBufferQuantity`
- Open / close / archive event
- Show today's inventory table

Current state:

- `state.events`
- `state.products`
- `state.inventory`
- `state.orders`
- `state.selected`

Current APIs used:

- `GET /api/admin/events`
- `POST /api/admin/events`
- `PATCH /api/admin/events/:eventId`
- `POST /api/admin/events/:eventId/open`
- `POST /api/admin/events/:eventId/close`
- `POST /api/admin/events/:eventId/archive`
- `GET /api/catalog/products/published`
- `GET /api/admin/events/:eventId/sellable-inventory`
- `PUT /api/admin/events/:eventId/sellable-inventory`
- `GET /api/events/:eventId/orders` only when selected event is OPEN

Data owner:

- Operations owns Event and Sellable Inventory.
- Catalog only provides published Product Contract snapshots.

Risk:

- Current UI is in the wrong place for daily use.
- Current service allows inventory edits only when Event status is `draft`.
- Legacy-style day board appears to need edits during the active business day. That is a business-rule decision, not a UI-only decision.

## 3. Database / Domain Ownership

### Catalog-owned data

Tables:

- `catalog_categories`
- `catalog_products`
- `catalog_product_drafts`
- `catalog_product_draft_channels`
- `catalog_product_versions`

Fields currently available:

- category code / display name / sort order / active
- internal product name
- draft display name
- draft POS name
- draft selling price
- draft description
- draft channels
- published versions

Important absence:

- There is no formal product cost field in current Catalog domain.
- There is no formal BOM field in current Catalog domain.

Conclusion:

- Adding true `成本` or `BOM` as writable production data is not a UI-only change.
- It requires an approved data-owner decision, likely Cost domain or explicitly approved Catalog draft metadata.

### Operations-owned data

Tables:

- `operations_events`
- `operations_product_copies`
- `operations_sellable_inventory`
- `operations_orders`
- `operations_order_items`
- closeout / daily report tables from lifecycle phase

Fields currently available for daily stock:

- `planned_quantity`
- `reserved_quantity`
- `sold_quantity`
- `safety_buffer_quantity`
- computed `remainingQuantity`
- computed `customerAvailableQuantity`

Important behavior:

- `remainingQuantity = planned - reserved - sold`
- `customerAvailableQuantity = max(0, remaining - safetyBuffer)`
- Product data in Operations is a snapshot from Product Contract v2.

Current edit restriction:

- `OperationsService.setSellableInventory()` rejects unless Event status is `draft`.

## 4. Existing Overlap / Duplicate Logic

There are two separate UI implementations:

1. Catalog UI in `src/web/admin/page.ts`
2. Event inventory UI in `src/web/events/page.ts`

They are not currently shared.

Potential duplicate risk if implementation is careless:

- two separate product lists
- two separate category selectors
- two separate inventory tables
- two separate "today" calculations
- two separate save flows

Recommended single-source rule:

- Catalog fields still save only through Catalog APIs.
- Daily inventory fields still save only through Operations inventory API.
- The Back Office first page may aggregate both, but it must not create a second data model.

## 5. Proposed Safe UI Direction

Change `/admin` from "Catalog-first page" to "Daily Inventory Workbench first page."

Recommended visible order:

1. Header: 後台管理 / 今日備貨與剩餘
2. Current day card:
   - current OPEN Event if exists
   - otherwise latest draft or "建立今日營業日" prompt
3. Daily inventory table:
   - POS name
   - full customer-facing name
   - category
   - selling price
   - planned quantity
   - safety buffer
   - customer available
   - reserved
   - sold
   - current active order quantity
   - remaining
   - per-event disable / restore
   - details expansion
4. Product quick-add area:
   - creates Catalog draft / published product only if explicitly filled
   - then adds published product to today's inventory
5. Last closeout summary:
   - read-only summary from existing statistics / closeout API if available
6. Secondary section:
   - current Catalog category and product management moved lower on the same page, or kept as "商品目錄" tab.

## 6. Recommended Minimal Implementation Scope

Allowed without new architecture decision:

- Reorder `/admin` UI so daily inventory is the first visible workbench.
- Reuse existing APIs listed above.
- Keep `/admin/events` as a secondary event setup page.
- Keep all data writes through existing services.
- Keep Product Contract unchanged.
- Keep Cost/BOM disabled or read-only placeholder.
- Keep Customer / Preorder / Kiosk out of scope.

Potentially allowed only if accepted as UI aggregation:

- `/admin` can load the current OPEN Event and call `GET /api/admin/events/:eventId/sellable-inventory`.
- `/admin` can show Catalog fields and Operations fields in one row if each save button uses the correct API.

Must stop for Architecture Owner decision:

- Allowing inventory edits while Event is OPEN.
- Adding real cost fields.
- Adding real BOM fields.
- Adding report/waste cost persistence.
- Changing Event lifecycle or closeout rules.
- Creating new tables or migrations.
- Creating a new combined API endpoint.

## 7. Specific Decisions Needed Before Implementation

1. Should `/admin` show only the current OPEN Event, or can it also show the latest DRAFT when no Event is open?
2. Should a "今日營業日" be auto-created when there is none, or should the operator press a button?
3. Can inventory be edited after Event is OPEN?
4. If OPEN inventory edit is allowed, is it only additive replenishment, or can planned quantity decrease too?
5. Should "停用" mean `plannedQuantity = 0` for the current Event only?
6. Should "恢復" use the last saved planned quantity, or require manual input?
7. Are `成本` and `食材明細/BOM` temporary notes for display only, or formal Cost domain data?
8. Should "新增品項" create and publish a product immediately, or create draft first then require formal publish?
9. Should `/admin/events` remain accessible, or be renamed to "營業日設定" to avoid confusing it with daily stock?
10. Should last closeout summary use existing `/api/events/:eventId/statistics` / daily report only, or wait for a dedicated history view?

## 8. Recommended Next Step

Do not modify database yet.

Next approved implementation should be:

1. Make `/admin` first page load the current Event and existing inventory read model.
2. Render the Legacy-style "今日備貨與剩餘" table at the top.
3. Move the existing Catalog category/product forms lower on the page or behind a tab.
4. Keep all writes pointed at existing Catalog and Operations APIs.
5. If the selected Event is OPEN, keep stock inputs read-only until Architecture Owner approves an OPEN replenishment rule.

This gives the owner the correct daily screen without changing domain rules.

## 9. Review Summary For GPT / Claude

The desired correction is UI/workflow placement, not data ownership reversal.

Correct interpretation:

- "場次歸場次" remains true.
- "備貨 directly with 商品目錄功能" means daily operator UI should combine product rows and daily stock rows.
- It does not mean storing daily stock inside Catalog tables.
- Event Inventory remains the source of daily quantities and closeout history.
- Catalog remains the source of reusable product master data.

Main warning:

The current code forbids changing sellable inventory after an Event is OPEN. If Legacy required changing 備貨 during service, that is the next real architecture/business decision.
