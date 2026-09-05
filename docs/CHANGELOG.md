# Changelog

## 2026-09-05 - PR-OPERATIONS-004 implementation authorized

- Recorded DECISIONS #097 from the Owner instruction
  `確認開始 PR-OPERATIONS-004`.
- Began the contained Operations-only pending-modification foundation and its
  isolated migration/application/persistence/concurrency validation.
- Commit, push, PR, merge, deployment, Windows UAT, live SQLite, Cloudflare,
  Scheduled Task, Docker/n8n, WSL, and Legacy remain unchanged and gated.

## 2026-09-05 - POS Order replacement architecture prepared

- Recorded DECISIONS #096 for documentation and architecture review only.
- Added the pending-intent state machine, lazy-root replacement model,
  two-phase external payment adjustment, cross-device recovery, exact inventory
  reservation, immutable finished-item disposition, closeout blocking, and
  forward-only migration/rollback plan.
- Added three dependent Task Cards for foundation, payment/recovery/disposition,
  and POS/Kitchen workflow. Architecture Review later passed; subsequent
  implementation authority is recorded separately in DECISIONS #097.
- Documentation only: no source code, migration file or execution, database,
  Windows UAT, Cloudflare, Scheduled Task, Docker/n8n, WSL, or Legacy change.

## 2026-08-11 - Canonical Ingredient management UI technical completion

- PR #22 recorded the independently reviewed PR-INGREDIENT-003C Task Card as
  merge commit `c15a03e138e21328a3db0c88f861bca1b6af7e8c`.
- PR #23 merged seven approved feature commits as
  `ea46678cbb955b7aeb093dc34525c52325af9cae`, with exact scope of six files and
  `+1288/-11`.
- The Owner accepted post-merge validation and designated `ea46678...` as the
  Architecture Development Baseline. This is not `main`, release, deployment,
  production database, or runtime provenance.
- Independent remediation review closed Original Findings 1 through 5 with
  zero blocking and zero non-blocking findings. Remote checks were
  `NOT CONFIGURED`; complete local and independent validation evidence is
  recorded separately in the Test Plan.
- Ingredient 003C is technically complete. Its governance closeout remains
  pending until this prepared documentation receives independent review and a
  separately authorized merge. Ingredient 003D, Reference Impact,
  reactivation, deletion, and merge/alias work remain unauthorized.

## 2026-08-10 - Canonical Ingredient lifecycle command and management API closeout

- PR #14 recorded the Owner-accepted PR-INGREDIENT-003 Proposal as merge
  commit `b3f2e5e28ff55f988859c8e438f8128875d80fe7`.
- PR #15 recorded the Owner-approved PR-INGREDIENT-003A Task Card as merge
  commit `f8dc8af112deaf478621bb653cd782d09e0425db`.
- PR #16 implemented the six-file Canonical Ingredient Rename/Archive command
  boundary and merged approved Head
  `2b93889fd4a06351d650d73e12ab8567f5fff0f9` as
  `b5641482bbfe34d110ccdf40d1ab5347850a9155`.
- PR #17 recorded the Owner-approved PR-INGREDIENT-003B Task Card as merge
  commit `5c2a69282567c6456a5d2e7e2628270a03847e57`.
- PR #18 implemented the approved 12-file management-read, SQLite persistence,
  server composition, and API boundary at `+1523/-9`. Approved Head
  `784bb00912fd957dab6a84448dd8f640f0e166fc` merged as
  `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96` after the documented review and
  remediation sequence.
- The Owner accepted `97d6c7b52f09643b2cafaa50711f76ccc1ae7a96`
  as the Architecture Development Baseline. It is not remote `main`, release,
  deployment, or runtime provenance.
- PR #19 recorded only the post-PR18 Ingredient 003B governance closeout Task
  Card. Approved Head `7c80fbd13bb196d9c78e938baeb9625a6658e1d3`
  merged as `58cce2327f3f7121442e8a0cd4cd29693b9fde3c`.
- Ingredient 003C, UI/navigation, Reference Impact, reactivation, deletion,
  merge, main promotion, release, and deployment remain unauthorized.
- This closeout creates no new DECISIONS number and does not rewrite
  DECISIONS #069, the Proposal, or either historical Task Card.

## 2026-08-09 - Post-PR11 governance synchronization

- PR #10 recorded the COST-REGRESSION-001 Task Card as merge commit
  `a2791a36c1f063cdf0218aa91ce78955227323a0`; it authorized no implementation.
- PR #11 corrected nested SQLite transaction semantics in exactly the shared
  adapter and transaction-failure integration test. The initial independent
  review found that a failed `ROLLBACK TO` skipped final `RELEASE`; the
  authorized remediation preserved both cleanup attempts and ordered failure
  evidence. Approved Head `132789ccbbe65168aa79aa1888b1b3ec4424855d`
  merged as `1c31a31030e7c0d29181ebcc5355a706db95dc50`.
- PR #11 post-merge verification passed and COST-REGRESSION-001 is closed. The
  earlier 466/470 diagnostic and four failures remain historical discovery
  evidence, not current unresolved test state.
- The Owner formally designated `1c31a31030e7c0d29181ebcc5355a706db95dc50`
  as the Owner-Accepted Architecture Development Baseline. This is not remote
  `main`, promotion, release, deployment, or runtime provenance.
- PR #12 recorded only the post-PR11 governance synchronization Task Card. Its
  approved Head `96ae03cb7b97e2c2bedeabb1323e780c80dbbb9e`
  merged as `20bca12ac7c2620ea2fc3c808bab035c9b5311fa`.
  That documentation-only Git advancement is the Phase B branch base and does
  not redesignate the accepted baseline or complete Phase B.
- No new Decision number was created for COST-REGRESSION-001. Its closeout
  cites DECISIONS #051, #065 and the explicit Owner authorization and review
  records.

## 2026-08-09 - DECISIONS #070 Recipe Management Historical Closeout

- Recorded DECISIONS #070 as a retrospective governance ratification. The
  record does not invent or backdate a historical Decision number and does not
  expand earlier implementation authority.
- Added an independent Recipe Management Closeout Record covering Proposal,
  001A, 001B, PR #3 through PR #7, the two blocking 001B remediation reviews,
  the third approving review, and the final merge evidence.
- Synchronized current-state documentation after PR #8 while preserving the
  distinction between the Owner-Accepted Architecture Development Baseline
  `6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7` and current remote integration
  Head `b107c6c7a4a2caca25bd46b138bd8baebbd97c1b`.
- Recorded Recipe 001A/001B as completed and merged, Recipe 001C-001E as
  unauthorized, Cost Back Office as contained but not released/deployed, and
  migrations 001-017 as the repository migration range.
- Recorded remote `main` as nonexistent, local `main` as unpromoted, and
  `origin/HEAD` only as an observed abnormal pointer. No ref was changed.
- Recorded an unresolved current regression that the configured 64-test
  `npm test` selection does not expose: direct all-file runs pass 466/470 and
  fail four Cost SQLite integration cases through nested transaction paths.
  No remediation was performed by this documentation task.
- Documentation only: no source, test, migration, script, package, runtime,
  database, Ingredient Proposal, main, release, deployment, branch, or
  worktree change.

## 2026-08-01 - DECISIONS #068 Realtime Heartbeat Reliability Correction

- Kept SSE heartbeat refresh and connection-health behavior while preventing the transport heartbeat from replacing the debug panel's last formal business event.
- Added Browser E2E coverage that crosses a heartbeat interval and proves the business-event trace remains visible.
- No Domain, Contract, API, database, migration, Cost, Recipe, Recovery, release, or deployment behavior changed.

## 2026-08-01 - DECISIONS #067 Existing Database Upgrade Verification

- Added a disposable, populated migration-014 fixture that exercises the production migration runner through migrations 015 and 016.
- Verification preserves and compares all pre-existing SQL values, checks foreign-key and SQLite integrity, proves the new Measurement Profile and Recipe history schema is usable after restart, and confirms migration rerun idempotency.
- No migration, production database, Domain contract, runtime/API/UI behavior, Recovery content, or release state is changed.

## 2026-07-23 - DECISIONS #046 ROS Self-Starting Runtime

- Added ROS-only Windows start and stop scripts plus thin batch wrappers. The start path uses formal ROS build/runtime files on local port 3092, verifies central SQLite health, starts the canonical Quick Tunnel, and writes the current public links under ignored `runtime/` state.
- Hardened ROS process ownership: stop behavior requires both the ROS-owned PID file and matching process name/start marker, so it does not sweep unrelated Node or cloudflared processes.
- Added a Windows runtime operation guide and a local `Desert Island ROS Startup` Task Scheduler entry for current-user logon with a 30-second delay and limited privileges.
- No Domain, API, schema, migration, contract, business rule, Legacy, n8n, Docker, or ngrok behavior changed.

## 2026-07-23 - AI Handover Integration

- Added AI onboarding and handover material under `docs/bootstrap/`, including a Git-backed current handover and a copyable new-session prompt.
- Added the bootstrap reading order to `AGENTS.md`, while explicitly preserving `CONSTITUTION.md`, accepted ADRs, and Architecture Owner Decisions as higher authority.
- Corrected bootstrap wording so Kitchen, Customer, and Payment are not presented as newly created independent domains.
- Documentation only: no source, API, schema, migration, business rule, test, Legacy, commit, merge, or tag change.

## 2026-07-22 - DECISIONS #041A Catalog Category Automatic Code

- Changed Catalog category creation so new category codes are generated by the backend in `cat-0001` format inside the Catalog create transaction.
- Simplified Back Office category management: users edit only 品項分類名稱, sort order, and active state; category code is read-only system information.
- Preserved existing legacy category codes and all `categoryId` relationships. No Product Contract, Operations, Event, Order, Inventory, Cost, Payment, Legacy, schema, migration, or existing data change.

## 2026-07-22 - DECISIONS #037 Phase B-1 POS Basic Operating Loop

- Added central Order fields for `customer_phone_tail`, `payment_method`, and `served_at` through additive Operations migration `008_phase_b1_pos_operating_loop.sql`.
- Extended POS Order creation and lifecycle read models to preserve optional phone tail, limited POS payment method (`CASH` / `LINE_PAY`), and served timestamp without introducing a Payment domain.
- Updated `/pos` to collect phone tail/payment method, keep financial closeout off the main POS surface, show active current-Event Orders, and separate today's served Orders.
- Updated `/kitchen` to display phone tail/payment method while remaining production-status-only.
- Added unit, integration, and E2E coverage for phone tail, payment method, served read model projection, current-Event active/served lists, and cross-device realtime updates. No Customer/Kiosk/Preorder, Cost, Voice, Google Sheets, AI, `/debug/devices`, Legacy, no-show, cancellation, or Event Close rule change.

## 2026-07-21 - DECISIONS #034 Device Connectivity Dashboard

- Added a ROS-only, read-only SSE device dashboard and ephemeral connection telemetry. No business data, SQLite state, contracts, or Legacy behavior is changed.

## 2026-07-21 - DECISIONS #018 Quick Tunnel External Verification

- Added ROS-only Quick Tunnel start/stop helpers for the no-Zone Shadow Run fallback on local port 3092.
- Verified the temporary external health, POS, Kitchen, and Statistics endpoints.
- No named Tunnel, Zone, DNS, Cloudflare service, Legacy, ngrok, n8n, or business behavior change.

## 2026-07-21 - DECISIONS #017 Cloudflare Tunnel Deployment Preparation

- Added credential-free Cloudflare Tunnel configuration and Windows start/stop/readiness/service templates for a ROS-only Shadow Run endpoint.
- Added Owner-only authorization, safe rollback, health, and Legacy-isolation instructions.
- No Cloudflare login, Tunnel creation, Windows service installation, business behavior, or Legacy change.

## 2026-07-21 - DECISIONS #016 Realtime Synchronization Hardening

- Added shared POS, Kitchen, and Statistics connection telemetry: device identity, Connected/Reconnecting/Offline state, current Event, last event, last sync, reconnect count, server time, SQLite state, and an opt-in Debug Mode panel.
- Hardened recovery behavior around SSE reconnect, 10-second REST polling fallback, online/offline transitions, and browser focus/visibility resume. Every refresh reads central SQLite through existing APIs.
- Added four-context Playwright coverage for POS-A, POS-B, Kitchen-A, and Statistics status propagation without page reload, plus the Windows manual checklist at `docs/acceptance/SYNC_TEST.md`.
- No business model, contract, Event, Order Lifecycle, Payment, Cost, or Legacy change.

## 2026-07-20 - External Shadow Run (DECISIONS #014, unmerged)

- Added SSE anti-buffering and a three-second reconnect hint for temporary tunnel transport.
- Added minimal POS and Kitchen connectivity states: connected, reconnecting, and offline/unreachable. Network failures explicitly say the mutation was not delivered; no offline queue was added.
- Added ngrok Basic Authentication environment placeholder and external device operating instructions. No URL, credential, business rule, Contract, or domain behavior is committed.
- External endpoint verification is blocked by the existing Legacy ngrok endpoint. Pooling is deliberately rejected because it would mix Legacy and ROS upstreams.

## 2026-07-20 - 2026-07-26 Shadow Run MVP (DECISIONS #013, unmerged)

- Added central SQLite Kitchen work queues at `/kitchen`; Kitchen changes only the independent production state.
- Added REST/SSE change notifications and central refresh for POS, Kitchen, and closeout views. No browser storage is a formal Order source.
- Added owner-only `/pos/statistics`, additive Event closeout persistence, append-only closeout audit, and central totals for orders, quantities, remaining portions, ledger total, unresolved Orders, cancellations, and no-shows.
- Added Playwright acceptance for POS A, POS B, Kitchen C, final-portion concurrency, reconnect reload, and closeout persistence.
- Did not add Payment, Customer, Preorder, LINE, n8n, Cost, Google Sheets, Voice, VPS, or Legacy changes.

## 2026-07-20 - Phase 1C.2-R ADR-014 Remediation

- Restored separate Order, Payment, and Production state models. New POS Orders are confirmed/unpaid/not_started; production changes no longer mutate Order status.
- Replaced `no_show` Order status with cancelled Orders carrying `cancellationReason=no_show` and append-only `order.no_show` audit records.
- Reworked lifecycle migration behavior: `005` no longer rewrites confirmed Orders, and repeatable `006_restore_adr014_state_separation.sql` translates databases that ran the former lifecycle state model.
- Routed the legacy Admin Event Close endpoint through the same confirmed, idempotent lifecycle close service; no second close implementation remains.
- Added the Constitution Compatibility Gate and closed GI-001 with root cause `Architecture Compliance Gate Missing`.

## 2026-07-20 - Phase 1C-2 Order Lifecycle

- Added Operations-owned `pending`, `cooking`, `ready`, `completed`, `cancelled`, and manual `no_show` lifecycle with backend transition enforcement.
- Added one-time, manually confirmed no-show inventory release, immutable audit records, idempotent Event Close, Event lock, and persisted daily-report snapshots.
- Added lifecycle APIs and `/pos/lifecycle` staff console; added unit/integration and Playwright coverage for lifecycle, illegal transition, release replay/concurrency, Event Close lock/idempotence, and UI confirmation flow.
- Added `005_order_lifecycle.sql` and ROS v0.5 Draft documentation. No Payment, Kitchen, Kiosk, Preorder, Cost, Sales Contract, LINE, Google Sheets, or Legacy behavior was added.

## 2026-07-22 - DECISIONS #035 Front / Back Office information architecture

- Separated ROS staff-facing POS, Kitchen, and Back Office navigation under DECISIONS #035.
- Limited `/pos` to 現場點餐, 待出餐, 預約單, and 客人訂單 while keeping financial closeout off the POS main screen.
- Added Back Office navigation for Catalog, Event setup, Statistics/closeout, and Health/share links.
- Added `/admin/statistics` and `/admin/health` presentation routes while preserving `/pos/statistics` compatibility.
- Fixed Statistics event-name display to avoid undefined names when the read model returns snake_case rows.
- Added Front/Back Office device acceptance documentation. No domain, contract, schema, migration, Event Close rule, Device Registry, Payment, Customer, Cost, Voice, AI, LINE, n8n, Google Sheets, or Legacy behavior changed.

## 2026-07-20 - Phase 1C.1 POS Minimal UI

- Added a responsive POS shopping cart driven only by the Current Event and POS Order APIs.
- Grouped product cards by frozen display category and added POS short name, price, remaining quantity, quantity controls, total, submit-state protection, success number, refresh, and Order error messages.
- Added Playwright coverage for a two-product Order and two browser contexts competing for the final portion. Set the shared SQLite E2E suite to one worker so independent specs cannot pollute each other's database state.
- Did not add payment, Kitchen, Kiosk, preorder, cancellation, Sales Contract, Cost, or external integration behavior.

## ROS v0.4 - 2026-07-20

- Released the verified Catalog, Event, Sellable Inventory, and POS Order Core foundation locally as `v0.4-order-core`.
- Recorded the migration baseline through `004_order_core.sql`, automated acceptance coverage, architecture guards, and remaining intentional gaps.

## 2026-07-20 - Governance and Phase 1B acceptance follow-up

- Required all future implementation completion reports to begin with their `DECISIONS` approval record.
- Added explicit Architecture Owner questions for no-show handling and Event Close batch finalization; no behavior changed.
- Added a repeatable five-minute Phase 1B Event/Sellable Inventory acceptance checklist.

## 2026-07-20 - Phase 1C POS Order Core

- Added additive `004_order_core.sql` Operations schema for order fields, item snapshots, Event sequences, and Event-scoped idempotency records.
- Added POS-only `POST /api/orders` and `GET /api/orders/:orderId` with immutable snapshots, Event-local human-readable order numbers, safe public responses, and one `order.created` audit record.
- Used SQLite IMMEDIATE transactions and conditional quantity updates to prevent oversell; a failed multi-item Order rolls back all quantities and does not consume a sequence number.
- Added service/API coverage for rollback, idempotency replay/conflict, validation, snapshots, and concurrent final-portion requests. Payment, Kitchen, Kiosk, preorder, cancellation, Sales Contract, and Cost behavior remain unimplemented.

## 2026-07-20 - Phase 1C Design Finalization

- Frozen Architecture Owner policies for POS direct sold allocation, ten-minute Kiosk reservation, Preorder direct confirmation, Kitchen entry, and completed-only Sales Contract emission.
- Changed ADR-014 through ADR-018 from Proposed to Accepted, including the accepted production-stage cancellation/Waste reporting gap.
- Kept unresolved data-model, scheduler, refund, privacy, and customer-cancellation choices as explicit Architecture Owner questions. No implementation was added.

## 2026-07-20 - Phase 1C-Design Order Domain

- Added a documentation-only Order Domain design package and Proposed ADR-014 through ADR-018.
- Defined the candidate Operations Order model, independent state machines, Event quantity lifecycle, immutable snapshots, idempotency, and future integration boundaries.
- Added Architecture Owner open questions; no Order implementation, schema, API, UI, or external integration was added.

## 2026-07-20 - Phase 1B.1 Governance and Event Snapshot Freeze

- Recorded Architecture Owner approval for the completed Phase 1B scope.
- Added ADR-013, the Architecture Timeline, and the rule that no phase, scope expansion, or contract change begins without new explicit approval.
- Added snapshot regression coverage: an OPEN Event stays on its selected Product Contract v2 even after Catalog republishes a newer price.

## 2026-07-20 - Phase 1B Event and Sellable Inventory

- Added Product Contract v2 with approved category display snapshots and runtime validation.
- Added Operations-owned Events, single OPEN Event enforcement, sellable inventory allocation, and remaining quantity calculation.
- Added Event Admin, current Event public APIs, and event-scoped read-only POS display.
- Added unit, API integration, and UI E2E coverage. No orders, payments, Kitchen, Customer, Cost, or external integration was added.

## 2026-07-20 - Phase 1A E2E acceptance

- Added isolated Playwright Chromium acceptance tests for Admin publish to read-only POS.
- Added negative UI coverage for missing POS name, price, channels, inactive categories, unpublished products, and kiosk-only products.
- Added `test:e2e`, `verify:full`, ignored HTML/failure artifacts, and the five-minute manual acceptance checklist.
- Corrected draft saving so incomplete drafts can be stored and publication performs the required validation.

## 2026-07-20 - Phase 1A Catalog Admin

- Replaced the experimental SQLite runtime with `better-sqlite3` behind a Database Adapter.
- Added Catalog categories, editable product drafts, immutable published versions, channels, audit records, public Product Contract API, minimal Admin, and read-only POS display.
- Added adapter, Catalog, and publish-to-POS integration tests. No Operations or Cost behavior was implemented.

## 2026-07-20 - Phase 0.5 Constitution v2 alignment

- Added the controlling `CONSTITUTION.md` and Architecture Owner approval rule.
- Replaced the initial business schema with strict Catalog, Operations, and Cost prefixes.
- Moved BOM ownership exclusively to Cost and defined Product/Sales Contract v1.
- Added runtime validation, contract tests, SQL/import/prefix/infrastructure guard tests, and migration smoke verification.
- Added ADR-007 and ADR-008. No Phase 1 feature or legacy integration was started.

## 2026-07-19 - Phase 0 foundation

- Created isolated `desert-island-ros` Git repository.
- Added Node.js/TypeScript service shell, SQLite migration runner, and initial domain schema.
- Added health endpoint, SSE heartbeat, and four non-business UI shells.
- Added environment template, test, architecture documents, roadmap, decisions, legacy audit boundary, and six ADRs.
- Did not modify or import from the legacy project.
