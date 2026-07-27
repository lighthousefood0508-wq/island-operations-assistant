# Architecture Owner Memory

This document helps an AI understand how Architecture Owner Miles evaluates product, UI, workflow, and business-rule decisions in Desert Island ROS.

It is product context, not an architecture authority. `CONSTITUTION.md`, accepted ADRs, and explicit Architecture Owner Decisions remain higher priority. If this memory conflicts with one of them, follow the higher-priority source and report the difference.

## Architecture Owner

- Miles / 林子茂
- Food truck operator
- One-person operation
- Architecture Owner for ROS

Miles evaluates ROS against real service conditions: limited time, limited space, interrupted attention, and customers waiting in front of the vehicle.

## Product Philosophy

ROS is not merely a POS. It is a Restaurant Operating System for a one-person food truck.

The product exists to reduce mental overhead, avoid operational mistakes, and keep one central operational truth while Miles runs the stall. A feature is valuable when it makes the actual workday clearer, faster, or safer; novelty alone is not value.

## Workflow Philosophy

The daily mental model is Event-first:

```text
Today's Event
-> Products sold in this Event
-> Stock for this Event
-> Safety quantity
-> Open for service
-> POS
-> Kitchen
-> Close event
-> Statistics
```

An AI must not casually reorder this workflow around database tables, source folders, framework conventions, or a generic admin dashboard pattern. If the workflow needs to change, Miles must make that decision.

## UI Philosophy

The UI serves operating speed before visual decoration.

- Efficiency is more important than beauty.
- Workflow is more important than database structure.
- The current Event is more important than long-term product maintenance during daily service.
- POS should let staff find a product in about two seconds.
- High-frequency work should normally take no more than two interactions when the established flow allows it.
- Product Catalog is low-frequency management and belongs in Back Office, not on the POS working surface.
- POS should stay compact and uncluttered. Finance, Health, QR/share links, product maintenance, and system diagnostics belong in Back Office unless they directly speed up the cashier.

Miles is the final decision-maker for UI behavior after using it on real devices. A technically tidy layout is not enough if it slows service.

## Architecture Preferences

When trade-offs appear, the following preferences apply unless a higher authority says otherwise:

```text
Approved business rule
> AI best practice

Architecture Owner Decision
> framework convention

Single source of truth
> duplicated local state

Review
> coding
```

The practical meaning is simple: explain trade-offs, point out risks, and propose options, but do not substitute an AI's preferred architecture for a decision Miles already made.

## Domain Philosophy

The boundaries make change safer. They are not merely folder names.

- Catalog owns long-term product master data: categories, product versions, channels, and publishing.
- Operations owns service-day facts: Events, sellable inventory, remaining quantity, Orders, payments, kitchen progression, reservations, and published-product copies.
- Kitchen is an Operations capability that changes only approved production status. It does not own product master data, price, inventory planning, payment, or Event lifecycle.
- Cost owns BOM, ingredients, purchasing, cost inventory, and future cost/waste calculation. It must not directly read Operations Orders.
- Payment is currently an Operations-owned state model; provider integration and reconciliation remain deferred.
- Customer ordering is a future Operations flow. It must use the same central Order path when approved and must not create a separate browser-local order truth.

Catalog, Operations, and Cost must not be merged for UI convenience. Product Contract and Sales Contract remain the only cross-domain interfaces.

## Coding Philosophy

Before adding anything, find and understand the existing implementation.

- Do not create a second API for the same job.
- Do not create a second inventory model.
- Do not create a second remaining-quantity calculation.
- Do not create a second Event lifecycle or close path.
- Do not move a business rule into frontend code.
- Do not use localStorage, sessionStorage, or browser memory as the official source of an Order, Event, or inventory state.
- Prefer the existing Application Service, API, repository, contract, and UI path when it already owns the work.

If an existing path is inadequate, explain why and wait for the required Decision rather than building a parallel path beside it.

## Review Philosophy

Every construction task follows the same rhythm:

```text
Review
-> Decision
-> Implementation
-> Verification
-> Commit
-> Handover
```

Review means examining real code, real data flow, and existing tests before changing anything. Decision means confirming scope and ownership with Miles when needed. Verification proves the requested behavior without quietly weakening tests or rules.

## AI Behavior

An AI should:

- Offer clear options and a recommendation.
- Explain operational, architectural, and data risks plainly.
- Search for existing logic before proposing another implementation.
- Stop for Miles when a change affects a business rule, workflow, domain boundary, contract, API, schema, migration, or phase scope.
- Keep handover information tied to actual Git state.

An AI must not:

- Override a confirmed business rule.
- Change an established workflow by assumption.
- Redesign a Domain to satisfy a framework preference.
- Present discussion ideas as completed work.
- Hide an architecture or rule change inside UI, test, or documentation wording.

## Mental Model

If the design is unclear, imagine this moment:

```text
5 PM.
One food truck owner.
Left hand taking payment.
Right hand operating POS.
Food is cooking.
Five customers are waiting.
```

If the design increases that operator's thinking, it is wrong.
