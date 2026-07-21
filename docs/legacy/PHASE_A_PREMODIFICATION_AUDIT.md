# Phase A POS Core UI Restoration: Pre-Modification Audit

Approval: DECISIONS #021  
Scope: read-only architecture and implementation audit. No code, API, migration, database, Legacy, merge, or tag was changed.

## 1. Constitution compatibility

Reviewed: `CONSTITUTION.md`, `AGENTS.md`, ADR-013 through ADR-018, DECISIONS #013 through #020, GI-001, `docs/order/*`, `CURRENT_STATUS.md`, and `ROADMAP.md`.

Result: Phase A can restore the POS operating experience only by using existing Operations APIs and central SQLite. It must preserve Event Product snapshots, the three independent Order/Payment/Production states, transactional quantity allocation, idempotency, and shared realtime refresh. No conflict is found **provided that** Phase A does not implement payment, customer ordering, cancellation, completion, Cost, invoice, or a new contract.

## 2. Branch baseline and inheritance

### `main`

- Latest commit: `7424bf8 merge: accept ADR-014 remediation`.
- Formally merged: Catalog Admin, Product Contract v2, Event and Sellable Inventory, POS Order Core, POS minimal cart UI, and ADR-014 remediation.
- Not merged: Shadow Run Kitchen, central Statistics/Closeout UI, cross-device SSE hardening, external endpoint preparation, and Quick Tunnel tooling.

### Unmerged branch lineage

All current Shadow Run work is linear, not competing implementations:

```text
main 7424bf8
  -> feature/20260726-shadow-run-mvp fed959e
  -> feature/20260726-external-shadow-run 33354d9
  -> feature/realtime-hardening 8bd5f2f
  -> feature/cloudflare-tunnel-preparation 89fe2d9
  -> design/legacy-feature-parity-matrix f769663
  -> audit/phase-a-pos-ui-restoration (this audit)
```

| Branch | Latest commit | Added scope | Relationship / recommendation |
| --- | --- | --- | --- |
| `feature/20260726-shadow-run-mvp` | `fed959e` | central Kitchen, POS Event Order list, central Statistics/Closeout, SSE notifications, Shadow Run E2E | Parent of every later Shadow Run branch. Preserve; needs formal acceptance/merge decision. |
| `feature/20260726-external-shadow-run` | `33354d9` | protected external access preparation and same-origin checks | Direct descendant of Shadow Run; also aliased by `feature/ros-independent-external-endpoint`. Preserve one name only after Owner decides branch cleanup. |
| `feature/ros-independent-external-endpoint` | `33354d9` | No distinct content | Exact alias of the External branch. Do not develop separately; remove alias only after Owner approval. |
| `feature/realtime-hardening` | `8bd5f2f` | shared SSE/polling/debug behavior and realtime E2E | Direct descendant. Preserve; its shared realtime helper is the canonical client. |
| `feature/cloudflare-tunnel-preparation` | `89fe2d9` | Cloudflare/Quick Tunnel docs and scripts only, on top of Realtime | Most complete executable code baseline. Preserve until deployment decision. |
| `design/legacy-feature-parity-matrix` | `f769663` | DECISIONS #020 parity design documents | Direct descendant of `89fe2d9`; document-only. Base used for this audit. |
| `audit/phase-a-pos-ui-restoration` | current | This DECISIONS #021 audit only | No implementation. |
| `feature/phase-1c1-pos-ui` | `2cb2b2a` | Historic minimal POS UI | Already merged through `2885a7b`; retain for history only, never develop from it. |
| `feature/phase-1c2-order-lifecycle` | `544a5df` | Premature single-state lifecycle | Superseded by ADR-014 remediation; never merge. |
| `remediation/phase-1c2-adr014-recovery` | `71f1a8d` | ADR-014 recovery | Already merged through `7424bf8`; retain for traceability only. |

### Baseline recommendation

1. The most complete functional code baseline is `89fe2d9` because it contains Shadow Run, external preparation and realtime hardening on one line of history.
2. The best **Phase A source branch after governance approval** is `f769663` (or the then-current audit tip), because it includes the parity decisions without changing code.
3. Before Phase A implementation, Architecture Owner should accept and merge the linear Shadow Run/Realtime chain into `main`, then create one Phase A feature branch from that merge. This removes the risk of restoring UI on a branch that later lacks Kitchen, Statistics or the canonical SSE client.
4. Do not merge in this audit. If Owner intentionally keeps Shadow Run unmerged, Phase A must explicitly name `89fe2d9`/`f769663` as its base and later merge only once.

## 3. Existing POS component map

| Capability | Existing files / route | Existing function or component | API and formal data source | Usable status | Duplicate assessment |
| --- | --- | --- | --- | --- | --- |
| Formal POS entry | `src/web/pos/page.ts`, `GET /pos` | `renderPos()` | `GET /api/events/current`, `GET /api/events/current/products`, `GET /api/events/:eventId/orders`, `POST /api/orders`; Operations SQLite | Usable on Shadow Run line | Canonical POS page. |
| Product category/card display | `src/web/pos/page.ts` | inline `render()` groups `displayCategoryName` | Current Event Product snapshot; `operations_product_copies` + sellable inventory | Usable | No second real POS product renderer. |
| Browser cart | `src/web/pos/page.ts` | `s.cart`, `render()`, click/input listeners | In-memory only until submit; no formal order data | Usable | One real POS cart; Legacy is separate project and excluded. |
| Quantity, delete, subtotal/total | `src/web/pos/page.ts` | cart adjustment/delete and total calculation | Current Event remaining is display guard; server is final quantity authority | Usable | One real POS implementation. |
| Item note / order note | `src/web/pos/page.ts` | per-item `data-note`; `#order-notes` | Immutable Order item/order snapshot after `POST /api/orders` | Usable | One POS implementation. |
| Customer name / phone tail | `src/web/pos/page.ts`, `OrderService` | request currently sends `customerName: null`; no phone field | Order supports `customerName`; no defined phone-tail field | Partial | Must not add a shadow local field. Owner decision required. |
| Central Order creation / call number | `src/web/pos/page.ts`, `order-service.ts` | create button; `OrderService.createPosOrder()` | `POST /api/orders`; Operations transaction, order sequence, idempotency, audit | Usable | Single formal creation service/API. |
| Event Order list | `src/web/pos/page.ts`, `lifecycle-repository.ts` | POS `load()`; `LifecycleService.listEventOrders()` | `GET /api/events/:eventId/orders`; Operations SQLite | Usable on Shadow Run line | One API; two consumer UIs (`/pos`, `/pos/lifecycle`). |
| POS summary cards | `src/web/pos/page.ts`, `GET /pos` | `#remaining`, `#pending`, static preorder card | current products/order list | Partial: remaining total currently counts all products, not only main dishes; pending wording is local interpretation | One POS summary; needs presentation-only correction. |
| Status wording | `src/web/pos/page.ts` | inline `status(o)` | three fields returned by Event Order list | Partial | POS has one simplified mapper; `/pos/lifecycle` and Kitchen have separate direct rendering. Requires Owner-approved consolidation boundary. |
| Realtime connection | `src/web/shared/realtime-debug.ts` | `renderRealtimeDebug()`, `window.__rosRealtime` | `GET /events`, `/health`, registered REST reload function | Usable on Realtime branch | **Canonical single EventSource/polling client**. Do not add another. |
| Kitchen | `src/web/kitchen/page.ts`, `GET /kitchen` | `renderKitchen()` | Event Orders + `PATCH /api/orders/:id/status`; Operations SQLite | Usable on Shadow Run line | Separate role UI, not a duplicate POS. Must retain its production-only boundary. |
| Statistics / Closeout | `src/web/statistics/page.ts`, `GET /pos/statistics` | `renderStatistics()` | `GET /api/events/:id/statistics`, `PUT /api/events/:id/closeout`; `LifecycleService` | Usable on Shadow Run line | One formal data source/API. |
| Lifecycle operator page | `src/web/lifecycle/page.ts`, `GET /pos/lifecycle` | `renderLifecycle()` | Event Orders, lifecycle actions, close Event | Usable but out of Phase A | Duplicates some Order-list/status presentation and is not a normal POS entry. |
| Event Admin | `src/web/events/page.ts`, `GET /admin/events` | `renderEventsAdmin()` | admin Events and sellable inventory APIs | Usable | Owns Event setup. Its close button already routes to `LifecycleService.closeEvent()`, so no duplicate close service. |
| Catalog / product management | `src/web/admin/page.ts`, `GET /admin` | `renderAdmin()` | Catalog APIs | Usable | Separate Catalog ownership; POS must not absorb it. |
| Placeholder ordering route | `src/web/ordering/page.ts`, `GET /order` | `renderOrdering()` | no business API | Not usable; explicitly says Kiosk/Preorder not open | Obsolete placeholder once a real Customer phase has an approved route. |

## 4. Existing API and Application Service map

| API | Application Service / repository | Response responsibility | Current consumers | Duplicate API / Phase A action |
| --- | --- | --- | --- | --- |
| `GET/POST/PATCH /api/admin/categories` | `CatalogService` / Catalog repository | Category master | Admin | No duplicate. Do not change. |
| `GET/POST/GET/PATCH /api/admin/products`, `POST .../publish` | `CatalogService` / Catalog repository | Catalog master and publication | Admin/Event Admin | No duplicate. Do not change. |
| `GET /api/catalog/products/published` | `CatalogService.getPublishedProducts()` | published Product Contract v2 | Event Admin only | No duplicate. Do not use from POS while Event is open. |
| `GET /api/events/current` | `OperationsService.getCurrentEvent()` | current OPEN Event | POS, Kitchen, Statistics | Canonical. No new “current POS event” API. |
| `GET /api/events/current/products` | `OperationsService.getCurrentProducts()` / Operations repository | Event-owned Product Contract snapshot + remainingQuantity | POS | Canonical. No new menu or inventory API. |
| `GET/POST/PATCH /api/admin/events...` and sellable inventory endpoints | `OperationsService` / Operations repository | Event setup and planned/reserved/sold/remaining | Event Admin | Canonical admin-only APIs. No POS write access. |
| `POST /api/orders` | `OrderService.createPosOrder()` / `OrderRepository.transactionImmediate()` | POS Order, immutable item snapshots, atomic sold allocation, idempotency, order number, audit | POS | Canonical. Must not add another create endpoint. |
| `GET /api/orders/:orderId` | `OrderService.getOrder()` / Order repository | one formal Order detail | API/tests | Canonical. POS currently uses Event list instead. |
| `GET /api/events/:eventId/orders` | `LifecycleService.listEventOrders()` / Lifecycle repository | Event order read model with all three states/items | POS, Kitchen, Lifecycle | Canonical. No second list endpoint. |
| `PATCH /api/orders/:orderId/status` | `LifecycleService.changeStatus()` | legal state transition, currently production actions | Kitchen, Lifecycle | Canonical. Phase A must not use it for payment/completion. |
| no-show/release/close/daily-report endpoints | `LifecycleService` / Lifecycle repository | formal lifecycle and Event Close | Lifecycle UI, Event Admin close | Existing but out of Phase A. No new close action/API. |
| `GET .../statistics`, `PUT .../closeout` | `LifecycleService.getStatistics/saveCloseout()` | central Event statistics and audited closeout | Statistics | Canonical. No second finance/closeout source. |
| `GET /events` | `SseHub` | notification only; clients refetch central data | shared realtime helper | Canonical SSE endpoint. No page-level EventSource. |
| `GET /health` | server route | Node/SQLite readiness time | realtime helper/deployment | Canonical health endpoint. |

## 5. Legacy UI comparison for Phase A

### A. Preserve as staff interaction patterns

- Six-tab mental model: onsite ordering, pending fulfillment, reservations, stock, statistics, settings. Phase A should use the familiar navigation shape but only activate approved ROS destinations.
- Two-column onsite layout: grouped product cards beside a fixed cart.
- Product card: short name, price, remaining amount, obvious sold-out state.
- Cart: quantity controls, delete, clear, line totals, grand total, item note and order note.
- Three fixed POS summary cards: remaining main meals, pending production, preorder production.
- Direct entries to stock/Event administration and Statistics rather than showing finance on the POS homepage.

### B. Translate to ROS three-state semantics

- Legacy “pending / served / cancelled / no_show” is one mutable local value. ROS shows a staff-friendly label but retains Order, Payment and Production independently.
- Legacy payment buttons wrote a label on a local order. Phase A may show `unpaid`, but cannot show cash/LINE Pay as recorded payment or treat production as completion.
- Legacy remaining quantity is calculated on each page. ROS displays the server response and relies on the Order transaction at submit.
- Legacy “new day” reset becomes formal Event Close plus explicit next Event setup, never browser clearing.

### C. Exclude from Phase A

Payment, cash/LINE Pay persistence, completed, amendments, cancel/no-show, Kiosk, Preorder, voice, Cost, Waste, Google Sheets, invoice, Customer feedback, deadline/reminder configuration and all new domains/contracts.

### D. Never migrate these mechanisms

`localStorage` as Order truth, `storage` event synchronization, JSON customer order queue, per-browser number/availability calculation, frontend-to-Sheets writing and Legacy direct status/delete mutations.

## 6. Duplicate and near-duplicate logic audit

| Finding | Canonical source recommendation | Proposed later action | Impact / reason |
| --- | --- | --- | --- |
| `/pos` and `/order` are both ordering-named routes | Keep `/pos` + `renderPos()` | Remove `/order` route and `renderOrdering()` only when a separately approved Customer/Kiosk route exists or Owner confirms no external user depends on it. | `/order` is an unused placeholder, not a second formal cart. Avoid route breakage without decision. |
| `/pos` and `/pos/lifecycle` both list Orders | Keep `GET /api/events/:eventId/orders` and `LifecycleService.listEventOrders()` | Phase A should make `/pos` the only staff sales entry. Keep lifecycle page temporarily as an admin/lifecycle surface; later consolidate or rename only with explicit lifecycle scope. | One API/data source already exists; UI intent differs. |
| Status text appears in POS, Kitchen and Lifecycle | Keep the three state fields and central lifecycle rules; no UI may create a state of its own | Owner decision: either introduce one shared presentation mapper across these pages, or limit Phase A to the POS mapper and schedule cross-role presentation consolidation. | Kitchen needs production-focused language while POS needs a combined operator label. A shared helper expands scope across role UIs. |
| SSE/polling behavior | Keep `src/web/shared/realtime-debug.ts` | No removal needed; all participating pages must keep registering their loader with this helper. | It is the sole `EventSource` creator and sole polling timer. |
| Page-local `api()` wrappers | Keep them temporarily; they are small error/UI adapters, not separate data sources | Do not extract a second “API client” during Phase A unless Owner explicitly expands scope. | Refactoring them adds risk without solving a business duplicate. |
| Event Close entry points | Keep `LifecycleService.closeEvent()` and its existing API | Do not add a POS close API. Event Admin and lifecycle route already call the same formal service. | No duplicate service/rule exists. `OperationsService.closeEvent()` appears legacy/unused and should be reviewed for removal only in a separately approved lifecycle cleanup. |
| Statistics/Closeout | Keep `LifecycleService.getStatistics/saveCloseout()` | Do not add a POS-home financial panel or a second report endpoint. | One central SQLite read/write path already exists. |

## 7. Phase A precise implementation proposal

### In scope

1. Modify the existing `renderPos()` surface at `/pos`; do not create another POS route or page.
2. Restore Legacy-familiar navigation and onsite layout using only existing routes: `/pos`, `/admin/events`, `/admin`, `/pos/statistics`, `/kitchen` where appropriate.
3. Refine existing category cards, product cards, cart quantity/delete/clear, totals, item notes, order note, central submit, success call number and clear errors.
4. Add only customer fields already accepted by the existing Order contract; phone-tail is blocked until its data model is approved.
5. Render current Event orders using the existing Event Order list endpoint, with one POS-owned staff label mapper that never mutates state.
6. Correct the three fixed top cards to: remaining **main meals** only, pending production, preorder production shown as `尚未啟用`.
7. Retain the existing shared realtime helper. Debug remains hidden without `debug=1`.

### Explicitly out of scope

Payment behavior or cash/LINE Pay writing; completed; edit/cancel/no-show/release; Kiosk; Preorder; voice; Cost/BOM/waste/margin; Google Sheets; invoice; Customer; migration; Domain/Contract changes; any Legacy modification.

## 8. Pre-modification change plan

### A. Existing logic to modify

- `src/web/pos/page.ts`: sole POS layout, local in-memory cart and POS presentation.
- Possibly `tests/e2e/pos-ordering.spec.ts` and `tests/e2e/realtime-hardening.spec.ts`: update only existing acceptance coverage for Phase A UI behavior.

### B. Potential existing files, only if needed after approval

- `src/server/app/routes.ts`: only to remove `/order` **if** Owner approves its removal and no dependency remains. Phase A should not add APIs.
- `src/web/ordering/page.ts`: only with the approved `/order` removal.
- `src/web/shared/realtime-debug.ts`: only if a purely presentational POS integration defect is proven; no second realtime client.

### C. New files

No new production file is required for the minimum Phase A proposal. The existing `renderPos()` and shared realtime helper are appropriate locations. A shared status-presentation helper is deliberately **not** proposed until Owner chooses whether cross-role UI consolidation belongs in Phase A.

### D. Single-source decisions

- Formal cart: `src/web/pos/page.ts` browser memory only until one `POST /api/orders` succeeds.
- Formal Order creation: `OrderService.createPosOrder()` through `POST /api/orders` only.
- Formal remaining quantity: Operations Event Product API and transactional Order repository only.
- Event Order list: `LifecycleService.listEventOrders()` through its one GET route.
- Realtime: `src/web/shared/realtime-debug.ts` only.
- Statistics/Closeout: `LifecycleService` only.

### E. Proposed removals, not executed

1. `/order` and `src/web/ordering/page.ts` after Owner confirms there are no external links and approves an eventual real Customer route.
2. The unused `OperationsService.closeEvent()` only after a separate lifecycle cleanup audit confirms no tests or caller rely on it.
3. Do **not** remove `/pos/lifecycle` in Phase A; it contains approved lifecycle actions that are out of scope, though it should not be linked as a second normal POS workflow.

### F. Why modify existing implementation

`renderPos()` already owns the only central POS cart and calls the canonical APIs. Changing it preserves idempotency, snapshot pricing, central remaining quantity and realtime behavior without an adapter, duplicate API, duplicate cart, or browser-owned Order state.

## 9. Test plan after approval

1. Preserve existing Order Core, lifecycle, Shadow Run and realtime tests.
2. Update the existing POS Playwright test to verify grouped cards, cart add/minus/delete/clear, per-item notes, order note, submit disabled state, order number and central remaining refresh.
3. Verify the three header cards: main meal calculation, central pending count, preorder explicitly not enabled.
4. Verify two POS contexts retain SSE/polling synchronization with Kitchen and Statistics without refresh.
5. Verify no finance values appear on `/pos`; Statistics remains the only financial display.
6. Re-run architecture guards, typecheck, lint, unit/integration/E2E, `verify`, and `verify:full`.

## 10. Blockers and Architecture Owner decisions

1. **Branch acceptance:** approve whether to merge the linear Shadow Run -> Realtime chain into `main` before Phase A. Recommended: yes.
2. **Phone tail:** current central Order contract does not define it. Phase A must omit it unless Owner approves a Contract/schema decision.
3. **Status presentation:** approve whether Phase A may introduce one shared state-label helper across POS/Kitchen/Lifecycle, or whether it must constrain itself to POS wording only.
4. **`/order` placeholder:** approve removal after confirming no public/external bookmark depends on it.
5. **Verification environment:** this audit attempted `pnpm verify` and `pnpm verify:full`; both stopped before tests because `node` is unavailable in the current PowerShell PATH. No Node installation, PATH change, or project configuration change was made. Previously reported green status for `89fe2d9` is historical evidence only until the local runtime is restored.

## 11. Audit stop condition

This document completes the Pre-Modification Audit Gate. Implementation must not start until Architecture Owner explicitly approves the branch baseline and the listed Phase A decisions.
