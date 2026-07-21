# Legacy to ROS Feature Matrix

Approval: DECISIONS #020, Legacy Feature Parity Design - Part 1  
Status: design only. This document changes no code, API, migration, database, Accepted ADR, or Legacy file.

## Reading guide

Each row records the required fields compactly: **Legacy behavior; source; role; trigger/input/output; rule/data; ROS owner/service; status/dependencies/ADR; restoration/priority/risk**.

ROS status terms: **complete**, **partial**, **missing**, or **replaced**. “UI restoration” means the existing ROS behavior and data model can be surfaced without a new policy decision; it does not approve implementation.

## A. Onsite POS

| Feature | Legacy behavior, source, role, trigger, input/output, rule, data | ROS translation and status | UI restoration / priority / risk |
| --- | --- | --- |
| Category menu | Groups active products as meal boxes, rice, sides. `pos-app/app.js:1522-1551`; staff taps category section and product cards. Inputs: active product type; output: grouped menu. | Operations reads the OPEN Event product snapshot via `GET /api/events/current/products`. **Complete** for snapshot/category fields; POS grouping UI exists. ADR-013. | Yes / P0. Never read Catalog directly while an Event is open. |
| Product card | Shows POS short name, price, prepared stock and calculated remaining; tap adds one. `app.js:1522-1551`. Legacy rule blocks only if browser-calculated remaining is zero. Legacy data: `localStorage` products/orders/reservations/ticket. | Operations Product Contract v2 snapshot + Event sellable quantity. **Complete** for display and server oversell protection. ADR-013, ADR-015. | Yes / P0. ROS must not copy browser-side stock truth. |
| Cart add, minus, clear | Adds, decrements and removes item quantities; shows line items and total. `app.js:849-894`, `1554-1581`. Staff input; output local ticket. | POS browser-memory cart, then central order at submit. **Complete** for basic cart. No formal inventory reserve for POS per ADR-015. | Yes / P0. Cart is non-authoritative and can become stale. |
| Item note | Legacy item quantities have no per-item preparation note UI. The Legacy input scope listed this as an expectation but source code has none. | Order item `notes` exists in frozen Order policy; current UI support must be confirmed before implementation. **Partial**. ADR-014 order item snapshot. | Needs small UI/API verification / P1. Do not invent note semantics. |
| Order note | Legacy POS does not expose a general order-note input on `index.html`; customer page does. | Order-level `notes` exists in frozen policy; current POS support requires confirmation. **Partial**. | Needs design confirmation / P1. |
| Customer identity | Optional onsite name and phone tail are stored with the local order. `index.html:70-76`, `app.js:956-984`. | Central Order supports optional `customerName` and `customerContact`. **Partial**; ROS schema/API supports name, retention policy remains open. | Needs privacy and UI decision / P1. |
| Price total | Cart computes subtotal/total from mutable local product price. `app.js:549-555`, `1554-1581`. | Central immutable OrderItem snapshots calculate stored totals. **Complete** at Order Core. | Yes / P0. ROS must not recalculate old totals from current product price. |
| Cash / LINE Pay selection | Staff visually selects cash or LINE Pay before sending. `index.html:79-83`, `app.js:2109-2130`; it is only a label on an order. | Payment is a separate required state machine. **Missing**; cannot be recreated as a fake `paid` state. ADR-014. | Needs Architecture Owner payment decision / P0. |
| Invoice request fields | Records no invoice / receipt / company tax ID, title, carrier, note; explicitly does not issue an e-invoice. `app.js:895-954`. | No invoice field in frozen Order Entity; Invoice ownership is unresolved. **Missing**. | Needs decision / P1. Do not add JSON blob to Order. |
| Create onsite order | Local button creates pending order, increments browser order sequence, deducts only through calculated local remaining. `app.js:956-984`. | `POST /api/orders` creates central confirmed/unpaid/not_started order in an IMMEDIATE transaction, Event order number and idempotency. **Complete**. ADR-014/015/016/017. | Yes / P0. UI cannot claim payment or completion. |
| Human order number | Legacy increments `orderSeq` in one browser, displays padded number. `app.js:492-519`, `956-984`. | ROS Event-wide `{eventCode}-{sequence}` allocated transactionally. **Complete**. ADR-017. | Yes / P0. |
| Convert cart to reservation | Legacy local cart becomes a separate local reservation after entering pickup time/name/phone. `app.js:1424-1464`. | A submitted onsite Order must not be converted by an ad-hoc UI mutation. **Missing**, policy unresolved. | New state-transition design / P1. ADR-014/015. |
| Read remaining aloud / voice test | Uses browser speech synthesis for remaining count and a test phrase. `app.js:537-548`, `2109-2163`. | Does not affect data ownership. **Missing**. | Direct future UI restoration / P2. |

## B. Fulfillment and kitchen-facing workflow

| Feature | Legacy behavior, source, role, trigger, input/output, rule, data | ROS translation and status | UI restoration / priority / risk |
| --- | --- | --- |
| Pending fulfillment list | Combines local pending onsite orders with reservations inside fulfillment window. `app.js:1114-1159`, `1627-1722`. | Central order list and Kitchen read central Operations data. **Partial**: Shadow Run branches provide central list/Kitchen; main acceptance status must be chosen before release. | UI restoration after branch acceptance / P0. No local merge of order lists. |
| Production movement | Legacy POS directly marks served/cancelled/no-show; Legacy Kitchen is read-only summary, not workflow owner. `app.js:1230-1243`, `1627-1722`; `kitchen.js:252-314`. | Kitchen changes only `productionStatus` `queued -> preparing -> ready -> served`. **Partial** on Shadow Run branch. ADR-014. | Needs accepted Kitchen branch / P0. POS must not write Kitchen-owned transitions. |
| Cancel / no-show | Legacy uses single local status values and permits direct edits/deletes. `app.js:1230-1337`. | ROS no-show = `orderStatus=cancelled`, `cancellationReason=no_show`; manual only, audit required. **Partial**. ADR-014/015. | Needs policy/UI authorization decision / P1. |
| Edit unresolved order | Legacy lets staff edit customer, phone, payment and item quantities while pending/no-show. `app.js:1254-1310`, `1627-1722`. | Modifying a central submitted Order may change quantity and audit history. **Missing**. | New design / P0. Must define atomic allocation delta and production-stage rules. |
| Delete fulfillment item | Legacy can delete a local order/reservation and re-derives remaining. `app.js:1312-1337`. | No destructive deletion of central Orders; cancellation is audit-preserving lifecycle. **Replaced**. | No direct restoration / P1. |
| Speak pending orders | Browser reads pending order and reservation summary. `app.js:2137-2150`; Kitchen equivalent `kitchen.js:242-250`. | Voice presentation only after central query. **Missing**. | Direct future UI restoration / P2. |
| Kitchen summary | Legacy Kitchen derives pending order list, due reservations, prep counts and remaining quantities from localStorage; refreshes every 3 seconds. `kitchen.js:17-203`, `252-314`. | ROS Kitchen must query Operations API and use SSE/polling notification refresh. **Partial** in Shadow Run. | Restore only as read model / P0. Never migrate localStorage calculation. |

## C. Reservations, Kiosk and preorder

| Feature | Legacy behavior, source, role, trigger, input/output, rule, data | ROS translation and status | UI restoration / priority / risk |
| --- | --- | --- |
| Reservation list | Lists local reservations sorted by pickup time. `app.js:1154-1159`, `1723-1768`. | Operations owns future reservation/preorder behavior. **Missing**. | New design / P1. |
| Reservation edit / cancel / no-show | Legacy changes local time, identity and items; cancellation/no-show are one local status. `app.js:1245-1281`, `1723-1768`. | Requires separate rules for source, allocation, production stage and audit. **Missing**. ADR-014/015. | Architecture decision / P1. |
| Pickup-time range | Legacy allows 11:00-19:00 at 15-minute intervals; fulfillment window uses current time. `app.js:433-469`; `customer.js:121-142`. | Event-specific time and preorder deadline are unresolved. **Missing**. | New Event policy / P1. |
| Reservation reminders | Legacy checks every 30 seconds, speaks before pickup based on configurable minutes. `app.js:2087-2108`, `2319-2325`. | Scheduler and notification policy not approved. **Missing**. | Future Voice phase / P2. Must obey job boundary. |
| Kiosk ordering | `customer.html?source=kiosk&mode=kiosk`: customer identity, cart, menu, submit to `/api/customer-orders`; staff accepts/rejects. `customer.js:259-456`, `server.js:345-383`. | ADR-015 defines Kiosk submitted order plus 10-minute reservation, then payment converts to sold. **Missing**. | New Phase C design / P1. Legacy acceptance queue is not a valid central lifecycle. |
| Preorder | `mode=preorder` uses a `close` URL parameter; after deadline it permits menu browsing/feedback but not order submission. `customer.js:103-120`, `259-303`, `403-456`. | ADR-015 says preorder directly sells; deadline/quota fields are still open. **Missing**. | New Phase D design / P1. |
| Customer source / context | Kiosk, LINE, QR or staff source and event name appear in customer UI/order payload. `customer.js:242-259`, `385-401`. | Central Order has `source`; source-specific rules are frozen in Order docs. **Partial**. | Needs Customer adapters / P1. |
| Customer feedback after deadline | Legacy exposes feedback form and stores JSON; later syncs to Google. `customer.js:458-490`, `server.js:390-437`. | No approved ROS feedback domain or integration. **Missing**. | Future / P2. |

## D. Products, Event availability and cost-related display

| Feature | Legacy behavior, source, role, trigger, input/output, rule, data | ROS translation and status | UI restoration / priority / risk |
| --- | --- | --- |
| Create/edit product | Legacy POS edits name, type, price, cost, stock, full name, description and BOM text in one browser table. `app.js:1471-1521`, `1769-1970`. | Catalog Admin owns category/product/version/channel publishing. **Partial**: central Catalog exists, but it must not own Cost fields/BOM. | UI restoration only for Catalog-safe fields / P0. |
| POS short name / customer full name / description | Legacy supports each. `app.js:1471-1521`, `1769-1970`. | Product Contract v2 has safe display snapshots and channel data. **Partial**. ADR-013. | Needs Admin UI field confirmation / P1. |
| Active / inactive product | Legacy sets `active`; inactive products disappear from POS/customer but historical local orders remain. `app.js:1503-1521`. | Catalog publish/channel status affects future Events; OPEN Event snapshot cannot change. **Partial**. ADR-013. | New UI behavior design / P1. |
| Prepared quantity / remaining | Legacy per-product stock minus browser-derived sold, reservations, customer pending and cart. `app.js:849-874`, `1769-1970`. | Operations Event Sellable Inventory has planned/reserved/sold/remaining. **Complete** for POS direct sales; Kiosk/preorder rules remain future. ADR-015. | Yes / P0. |
| Cost and BOM text | Legacy stores mutable `cost` and descriptive BOM in POS state, then calculates margin locally. `app.js:556-562`, `1769-1970`. | Cost owns BOM/cost; Product Contract forbids those fields. **Replaced**. | No direct restoration / Future. |
| Waste / remaining retention | Legacy enters waste count at close, assumes remaining may be retained and computes waste cost. `app.js:1344-1355`, `1769-1970`. | Waste Contract/Cost flow is not approved; ADR-018 records the related accepted gap. **Missing**. | Architecture decision / P1. |

## E. Statistics, closeout and external integrations

| Feature | Legacy behavior, source, role, trigger, input/output, rule, data | ROS translation and status | UI restoration / priority / risk |
| --- | --- | --- |
| Financial dashboard | Legacy calculates revenue, cash/LINE labels, sales cost, waste cost, actual cost, profit and margin from local state. `app.js:1207-1228`, `1971-2047`. | Central closeout can show order count, amounts and manual reconciliation; Cost and margin are separate future domain data. **Partial**. | Basic statistics UI / P0; no fake cost/margin. |
| Closeout reconciliation | Staff enters cash and LINE Pay actual receipts, sees difference, then confirms a timestamp. `index.html:151-168`, `app.js:1338-1343`, `1971-2047`. | Shadow Run closeout reconciliation is central SQLite and audited. **Partial** pending branch acceptance. | UI restoration after acceptance / P0. |
| Event close and new day | Legacy snapshots local outing, clears orders/reservations/ticket, keeps product settings and resets sequence. `app.js:1356-1423`. | ROS `closeEvent()` is idempotent, blocks non-terminal orders, saves daily snapshot, locks Event. New Event is explicit Admin action. **Partial**. ADR-014, ADR-018. | Restore as two formal Operations actions / P0. |
| Order history | Legacy shows all local orders and invoice/sync status. `app.js:1971-2014`. | Central Order list/history exists; invoice and external sync do not. **Partial**. | Central history UI / P1. |
| Google Sheets export | Legacy manually sends served orders, lines, closing, waste and feedback via local server to n8n. `app.js:578-784`; `server.js:330-343`. | Sheets is report/export only, never source. Sales Contract emits only on completed. **Missing**. ADR-018. | Future Phase G / Future. |
| Links/settings | Legacy stores voice switch/reminder, event name, cutoff, Kiosk/LINE URLs and n8n field in localStorage. `app.js:722-784`, `2109-2229`. | Event/configuration must be centrally owned; external integrations need explicit phase. **Missing/partial**. | New settings design / P2. |

## Fixed UI principle

The ROS POS homepage shows only **remaining main meals**, **pending production**, and **preorder production**. It must not show revenue, payment totals, costs, gross profit, waste cost, or Google Sheets status. Financial information belongs only on Statistics and Closeout. The realtime debug overlay is hidden unless the URL includes `debug=1`.

## Evidence boundaries

Legacy inspected: `pos-app/index.html`, `app.js`, `server.js`, `kitchen.html`, `kitchen.js`, `customer.html`, and `customer.js`. Source locations above are Legacy implementation references, not approval to reuse its storage or business rules.
