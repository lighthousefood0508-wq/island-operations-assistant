# Current AI Handover

Last reality check: 2026-07-23 (Asia/Taipei)

## 1. Project

- Project: Desert Island ROS (荒島餐車 Restaurant Operating System)
- Repository: `C:\Users\user\Documents\荒島餐車 AI 營運資料庫\desert-island-ros`
- Architecture Owner: Miles / 林子茂
- Role: a central SQLite-backed restaurant operating system for a one-person food truck. ROS is being developed independently from Legacy; Legacy remains untouched unless a separate Decision says otherwise.

## 2. Product Baseline and Git Reality at Handover Creation

- Product baseline at handover creation: `a930b100e5beb640ef424ddeff87ddea24cce4fd`
- Product baseline subject: `feat: split back office pages and generate event codes`
- This handover was written against that product baseline before its documentation commit existed. It must not be read as a claim that `a930b10` remains the repository HEAD after this document is committed.
- Every new session must run `git status`, `git branch --show-current`, and `git log --oneline -20` to establish the real branch, HEAD, and working-tree state.
- If Git and this handover disagree, Git is authoritative. Report the difference; do not create follow-up commits merely to make this document chase its own documentation commit hash.
- Branch at handover creation: `feature/catalog-category-auto-code`
- Base branch: `main` at merge base `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`
- HEAD parent commit: `a548ee8f44c3b243014486222bebaacf4126fe3c`
- Merge status: this branch is not merged into `main`.
- Working tree at handover creation: documentation integration only under `docs/bootstrap/`, plus the permitted documentation updates made by this task.
- No product-code change is uncommitted as part of this task.

Other local branches exist for prior approved work. Do not merge or delete them by assumption. The current active line is the branch above.

## 3. Completed Work

The following are supported by committed code and/or formal Decisions:

- Central SQLite through the shared database adapter; browser storage is not an official order source.
- Catalog categories, draft products, immutable published versions, channels, and Product Contract v2 output.
- Category identity uses immutable `categoryId`; new category codes are backend-generated as `cat-0001` style under DECISIONS #041A. Existing legacy codes such as `bento`, `rice`, and `side` are preserved.
- Operations Events, a single OPEN Event rule, event product snapshots, sellable inventory, remaining quantity, and safety-buffer capability.
- Event code generation from the event date with a same-day suffix (`YYYYMMDD-01`, `YYYYMMDD-02`, and so on) in the Operations service transaction.
- POS Order Core: immutable item snapshots, event-local human-readable order numbers, source-scoped idempotency, atomic quantity handling, and audit records.
- Separate Order, Payment, and Production state fields in accordance with ADR-014.
- POS staff ordering, active/served order visibility, Kitchen production-status interaction, Statistics/closeout read surfaces, SSE notifications, and REST re-fetch after notification.
- Realtime visibility and polling fallback for POS, Kitchen, and Statistics; operational device telemetry is read-only and in memory.
- Back Office route separation: `/admin` is event-first, `/admin/catalog` is product-master maintenance, and `/admin/analysis` is an honest not-enabled placeholder.

Do not read this list as approval for a new phase. It describes the current repository state only.

## 4. Current Work In Progress

- The current branch contains committed Back Office reconstruction work, especially the split between `/admin` (場次與備貨) and `/admin/catalog` (商品目錄), plus safe backend event-code generation.
- The current uncommitted work is documentation only: bootstrap onboarding files, this real handover, the new-session prompt, and the associated `AGENTS.md`/status/changelog integration.
- This documentation task has not been committed, merged, or tagged.
- The Architecture Owner recently reported Event administration UI behavior that needs a separate approved diagnosis/fix before any product code is changed: opening a second Event is correctly rejected by the single-OPEN rule, while the close UI currently presents a confirmation requirement that needs review against the formal close endpoint.

## 5. Current Product Direction

- ROS is Event-first: each food-truck outing is the operational unit.
- Location and Event are conceptually different; location analysis remains deferred.
- `/admin` should prioritize creating/selecting an Event, selecting published products for that Event, setting sellable quantities, then opening/closing the Event.
- `/admin/catalog` is long-term product master work: categories, names, POS short names, price, channels, drafts, and publishing.
- POS is only for customer-facing staff ordering and order lookup during service; it must not become a finance or system-management screen.
- Kitchen changes only `productionStatus`; it does not edit product, price, inventory planning, payment, or event status.
- Financial, health, sharing, and device information belong in Back Office.
- Miles makes the final operational UI decision from real-device use, even when an AI prefers a different layout.

## 6. Domain Boundaries

- Operations owns events, availability, reservations, orders, order items, payments, kitchen progression, and published-product copies.
- Cost owns ingredients, aliases, conversions, BOM, purchasing, inventory movements, cost calculations, and future production/waste records. BOM stays in Cost.
- Catalog is a small Admin-owned product master. It owns categories, product versions, channel settings, and publishing state; it does not own orders, event inventory, payments, BOM, or costs.
- Product Contract v2 is the Catalog-to-Operations/Cost published-product interface. It excludes BOM, ingredients, cost, inventory, purchases, and payment data.
- Sales Contract v1 is emitted by Operations only when an Order becomes `completed`; it is deferred operationally and is not a live cross-domain read.
- Jobs may coordinate application services only. They may not execute SQL, directly access repositories, or contain business rules.
- Kitchen, Customer, and future payment-provider integration are capabilities within approved flows, not extra independent domains under the current Constitution.

## 7. Important Business Rules

- Central SQLite is the only formal source of live business data.
- SSE notifies screens of a change; each screen re-fetches central state through REST. SSE payload is not the source of truth.
- localStorage/sessionStorage may hold non-critical UI state only, never official Orders or event inventory.
- Final-portion protection, order number allocation, idempotency, and inventory counter changes occur in an Operations transaction.
- All category relationships use immutable `categoryId`, never a Chinese name or code.
- New category code generation is backend-owned and immutable. Legacy category codes are not renumbered.
- An OPEN Event reads only its Operations-owned Product Contract snapshot. Republishing a Catalog product cannot change that Event's price, names, categories, channels, or product version.
- `remainingQuantity` is derived from the event allocation: `plannedQuantity - reservedQuantity - soldQuantity`.
- `safetyBufferQuantity` exists as Operations data, but any customer-availability formula or automatic reservation behavior beyond current implemented behavior must be treated as a Pending Decision unless verified in the relevant service and Decision.
- ADR-014 retains independent `orderStatus`, `paymentStatus`, and `productionStatus`. Do not merge them in UI or storage.

## 8. Deferred / Not Implemented

- Customer/Kiosk production flow
- Full Preorder flow
- Order editing and complete operator/audit attribution policy
- Payment Domain, provider integration, and reconciliation
- Cost Domain runtime, BOM, purchases, waste cost, and daily Sales Contract import
- Location analysis
- AI inventory forecasting and AI Kitchen Copilot
- Formal authentication/authorization
- Archived category lifecycle beyond the current active-state behavior
- Google Sheets, LINE, n8n, Voice, and Legacy integration

## 9. Current Blockers / Open Questions

### Event Close UI confirmation

- Problem: the Architecture Owner reported that the Back Office close action surfaces `Event Close requires confirmed=true`.
- Current state: formal Event Close is governed by the Operations lifecycle service and should not be bypassed. The UI request path must be read and diagnosed before modification.
- Options: (A) add a UI confirmation that invokes the existing formal close API with its required confirmation payload; (B) if the endpoint/payload differs from the assumed route, correct only the existing UI invocation after a pre-modification audit.
- Blocking: blocks practical Event administration, but does not authorize a business-rule change.

### Current status drift

- Problem: historical status documents reference several old branches/phases.
- Current state: this handover is the Git-backed snapshot for the next AI. `CURRENT_STATUS.md` remains a high-level history/status document and should not be trusted for branch/HEAD without first running Git commands.
- Options: keep the real handover as the operational source, or approve a later documentation-cleanup Decision to reconcile old historical phase text.
- Blocking: does not block code work; it does block safe AI onboarding if Git is not checked first.

## 10. Next Recommended Task

### Event Close UI confirmation diagnosis and minimal repair

- Starting branch: `feature/catalog-category-auto-code` after the Architecture Owner reviews and either commits or preserves the documentation diff.
- Allowed scope: first perform a read-only pre-modification audit of the existing Event Close button, route, formal Operations lifecycle service, and relevant tests. Only after explicit approval, modify the existing Event administration UI and its focused tests if necessary.
- Prohibited scope: no new API, no new close path, no Domain/Contract/Schema/Migration/Product Contract change, no inventory or Event Close policy change, no Legacy change.
- Acceptance: an operator can explicitly confirm formal Event Close; unresolved-order blocking remains intact; repeated close remains idempotent; existing verification for lifecycle and Event behavior passes.
- Business-rule blocker: if the repair needs to alter unresolved-order policy, payment requirements, inventory behavior, or close semantics, stop and report the exact decision needed to Miles.
