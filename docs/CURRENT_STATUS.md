# Current Status

Date: 2026-07-23

## ROS Runtime

- DECISIONS #046 adds ROS-only Windows start and stop scripts, an ignored runtime link file, and a user-logon Task Scheduler entry delayed by 30 seconds. The runtime starts local ROS on port 3092, verifies `/health`, then creates a temporary Quick Tunnel. It records only its own Node and cloudflared PIDs, so Legacy, Legacy ngrok, Docker, n8n, and unrelated Node processes remain outside its control.
- A real Windows sign-out/sign-in acceptance remains pending Miles. The Task Scheduler manual Run acceptance passed; see `docs/deployment/ROS_RUNTIME_WINDOWS.md` for the exact verification and rollback steps.

## Current Phase

Post-DECISIONS #041A Catalog Category Automatic Code, with Back Office event-first page separation under active review.

## Current Branch

`feature/catalog-category-auto-code`

## Completed

- Catalog category automatic codes are implemented under DECISIONS #041A: new categories receive immutable backend-generated `cat-0001`-style codes, while existing legacy codes and `categoryId` relationships remain unchanged.
- Back Office now has separate event-first `/admin` and product-master `/admin/catalog` routes. Event codes are backend-generated from date with a same-day sequence such as `YYYYMMDD-01`.
- Documentation-only AI handover integration is in progress: `docs/bootstrap/` now contains onboarding guides, a real handover, and a new-session prompt. This does not change product behavior.

- POS header now shows the current Event, OPEN/CLOSED status, remaining main meals, active order count, preorder count fixed at 0, and operator fixed as `Owner`.
- POS system navigation has been moved into a right-side `系統` popup menu so the main surface remains dedicated to ordering only.
- POS now exposes only three staff operating tabs: `現場點餐`, `待出餐`, and `今日已出餐`. Preorder, Customer, inventory setup, health, sharing, closeout, and statistics remain Back Office concerns.
- POS product cards now use a dense 2-3 column Grid optimized for fast staff ordering: POS name, price, remaining quantity, and `+1` only. Product descriptions, images, and per-card quantity controls are intentionally absent.
- POS product groups now visibly preserve the Legacy category rhythm while keeping the ROS Product Contract snapshot as the data source.
- POS cart remains the only place for quantity changes, item notes, deletion, customer name, phone tail, payment method, order notes, and central order submission.
- POS active orders now show order number, customer name, phone tail, payment method, items, notes, wait time, and current three-track state labels.
- POS active orders can use existing production-status APIs for `開始製作` and `完成出餐`; the edit button is present but disabled for the next approved phase.
- POS today-served list remains scoped to the current Event and can search by customer name, phone tail, or order number.
- Kitchen UI has been polished as a production board with larger order numbers, clearer queue/preparing/ready columns, bigger action buttons, and the same right-side `系統` popup menu.
- POS, Kitchen, and Back Office navigation uses relative paths (`/pos`, `/kitchen`, `/admin`, `/admin/statistics`, `/admin/health`).

## Next Phase

Architecture Owner should decide the next operating-loop scope, most likely one of: edit order workflow, phone-tail lookup polish, or Payment phase.

## Open Questions

- Whether POS should expose a separate ready/served distinction to operators, or keep the current simplified `完成出餐` action that follows the existing production state machine.
- Whether edit order remains disabled until a dedicated change/audit policy is approved.

## Blocked

- Formal order completion remains blocked by the approved Payment model because orders are still `paymentStatus = unpaid`.
- Customer/Kiosk/Preorder, Cost, Voice, AI, LINE, and Google Sheets remain out of scope until separate DECISIONS approval.

Phase B-1 POS Basic Operating Loop is in progress on `feature/phase-b1-pos-operating-loop` under **DECISIONS #037**. It adds an Operations-owned additive migration for `customer_phone_tail`, `payment_method`, and `served_at`; POS can record customer name, optional phone tail, and a limited POS payment method (`CASH` or `LINE_PAY`) when creating central Orders; Kitchen still only changes `productionStatus`; POS now separates active current-Event Orders from today's served Orders. This does not add a Payment domain/provider/reconciliation, Customer/Kiosk/Preorder, Cost, Voice, Google Sheets, AI, `/debug/devices`, no-show, cancellation, Event Close rule changes, or Legacy changes.

Front Office / Back Office / Kitchen information architecture is complete on `feature/front-back-office-information-architecture` under **DECISIONS #035**, awaiting Architecture Owner acceptance. `/pos` is now a staff-facing ordering surface with only `現場點餐`, `待出餐`, and `今日已出餐`; inventory setup, preorder/customer surfaces, system health, sharing, and financial closeout have moved out of the POS main workflow. Back Office groups Catalog, Event setup, Statistics/closeout, Health, and link sharing under `/admin`, `/admin/events`, `/admin/statistics`, and `/admin/health`. Kitchen remains a production-status-only surface. This work changed presentation, routes, tests, and documentation only; no Domain, Contract, Schema, Migration, Event Close business rule, Payment, Customer, Cost, Device Registry, Voice, AI, LINE, n8n, Google Sheets, or Legacy behavior changed.

Device connectivity dashboard is complete under **DECISIONS #034** on `feature/device-connectivity-dashboard`. `/debug/devices` is a ROS-only, read-only view of active in-memory SSE connections. It records no SQLite data and does not affect Orders, Event, Catalog, Cost, Contracts, or Legacy. Existing POS, Kitchen, and Statistics all retain the one shared realtime client; a single SseHub heartbeat refreshes connection activity.

Quick Tunnel external verification is active under **DECISIONS #018**. ROS runs locally on `127.0.0.1:3092` against central SQLite and is exposed only through a temporary accountless `trycloudflare.com` URL. The public URL is intentionally not committed because it changes whenever Quick Tunnel restarts. No named Tunnel, Zone, DNS, Cloudflare service, Legacy, or business behavior was changed.

Cloudflare Tunnel Deployment Preparation is complete on `feature/cloudflare-tunnel-preparation` under **DECISIONS #017**, awaiting Architecture Owner authorization. `cloudflared` is installed locally; credential-free configuration, readiness reporting, ROS-only start/stop/service templates, documentation, and the excluded-data deployment ZIP are prepared. Owner login and named-Tunnel authorization remain manual; no actual Tunnel, Cloudflare service, credential, public hostname, or Legacy integration has been created.

Realtime Synchronization Hardening is complete on `feature/realtime-hardening` under **DECISIONS #016**, awaiting Architecture Owner acceptance. POS, Kitchen, and Statistics now expose central connection state, a query-string Device identity, optional debug diagnostics, SSE reconnect refresh, 10-second REST polling fallback, and browser-resume refresh. SQLite remains the only source of truth; SSE remains notification-only. No Order, Payment, Production, Event, Catalog, Cost, Contract, or Legacy behavior changed.

External Shadow Run work is on `feature/20260726-external-shadow-run` under **DECISIONS #014**. It prepares a protected temporary deployment layer only: ngrok Basic Authentication is supplied through an environment variable, pages/API/SSE remain same-origin and relative, and no URL or credential is written into ROS source. POS and Kitchen display central connectivity state. External verification is currently blocked because the configured ngrok account has its sole endpoint assigned to the running Legacy tunnel; ROS must not pool with or replace that tunnel without Architecture Owner direction.

Phase 1C.2-R was merged to `main` as `7424bf8` after its full verification. Migration `006_restore_adr014_state_separation.sql` has been applied to the development database. The current Shadow Run MVP is on `feature/20260726-shadow-run-mvp` under **DECISIONS #013** and remains unmerged. It adds central-SQLite Kitchen workflow, REST/SSE multi-device refresh, POS central order list, and central closeout reconciliation. `007_event_closeout_reconciliation.sql` is additive. All formal order data remains central; browser storage is used only for an unsent cart in browser memory.

The Shadow Run validates POS A, POS B, and Kitchen C against one Node.js service. Kitchen can change only `productionStatus` (`not_started/queued -> preparing -> ready -> served`); it cannot modify the Order, payment, price, quantity, or Event. `paymentStatus` remains `unpaid`, therefore ADR-014 correctly prevents formal Order completion until an approved Payment phase exists. This is an intentional 7/26 Shadow Run blocker for order completion only, not a reason to bypass Payment or fake a paid state. Formal Event Close still blocks confirmed Orders.

ROS v0.4 is released locally at `v0.4-order-core`; see `docs/releases/RELEASE_v0.4.md`. Phase 1C.1 POS Minimal UI is complete under **DECISIONS #006**. It consumes only the existing Current Event and Order APIs to provide grouped products, a local cart, quantity controls, submit-state protection, success order number, refreshed remaining quantities, and explicit Order error messaging.

Phase 1C.2-R Remediation is complete on `remediation/phase-1c2-adr014-recovery` under **DECISIONS #010**, awaiting Architecture Owner acceptance. POS Orders are `confirmed` / `unpaid` / `not_started`. Production progresses independently as `not_started -> queued -> preparing -> ready -> served`; an Order can complete only when payment is paid and production is served. No-show is `cancelled` with `cancellationReason=no_show` and append-only `order.no_show` audit. Migration `006_restore_adr014_state_separation.sql` recovers databases that ran the original lifecycle migration. Formal Event Close remains idempotent, blocks every non-terminal Order, persists a daily-report snapshot, and is the only Event Close service path.

Phase 1C Order Core is complete after verification. It implements POS-only Order creation and retrieval against an OPEN Event. A create operation runs in one SQLite IMMEDIATE transaction, creates confirmed/unpaid/not_started Order snapshots, atomically increases `sold_quantity`, assigns a shared Event order number, saves idempotency state, and records one `order.created` audit entry. Replays return the original order without another quantity deduction or audit entry.

Phase 1B and Phase 1B.1 are complete after verification. Phase 1B added Catalog Product Contract v2 display snapshots plus Operations Event and Sellable Inventory. Phase 1B.1 records Architecture Owner approval and freezes the OPEN Event Product Snapshot Policy: an OPEN Event reads only its Operations-owned Product Contract v2 snapshot, while a Catalog republish is selectable only by a new Event. Phase 1C-Design is complete as a documentation-only Architecture Review package; Phase 1C implementation is not approved or started. POS reads only the current Event API. SQLite uses `better-sqlite3` through a thin adapter. Playwright E2E acceptance verifies the UI catalog-to-event-to-POS flow on an isolated database.

Not implemented: payments, Customer/Kiosk, preorder, cancellation/refund, Cost/BOM/inventory behavior, Sales Contract execution, authentication, users/roles UI, LINE/n8n/Google Sheets/OpenAI integration, receipt processing, Docker, VPS, legacy migration, and production monitoring. Kitchen is implemented only for the DECISIONS #013 Shadow Run branch.

The Legacy project remains read-only and unmodified. Any new phase, scope expansion, or contract change requires explicit Architecture Owner approval before work begins.

Governance follow-up: completion reports now cite their `DECISIONS #XX` approval record first; the Phase 1C implementation record is **DECISIONS #004**. Every new Implementation Spec must begin with the Constitution Compatibility Gate. GI-001 is closed by DECISIONS #010 remediation. Phase 1B's repeatable five-minute acceptance checklist is in `docs/acceptance/PHASE_1B_MANUAL_ACCEPTANCE.md`.
