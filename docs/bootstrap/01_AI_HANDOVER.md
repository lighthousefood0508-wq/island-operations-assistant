# AI Handover

This is an AI onboarding summary for contributors working on Desert Island ROS. Read it after `CONSTITUTION.md`, relevant accepted ADRs and Architecture Owner Decisions, and `AGENTS.md`.

It is not an architecture authority. If it conflicts with those sources, they win and this document must be corrected.

## What ROS Is

Desert Island ROS is the Restaurant Operating System for a one-person food truck.

It is not only a POS screen. It is intended to become the operational backbone for:

- Daily event setup
- Product publishing
- Sellable inventory
- POS ordering
- Kitchen production flow
- Event closeout
- Statistics and future reporting

## Project Goal

The goal is to help one exhausted food truck operator run a service day with less mental overhead, fewer manual mistakes, and a reliable central source of operational truth.

The system must support actual food truck work:

1. Prepare today's event.
2. Select what is sold today.
3. Set sellable quantities and safety buffers.
4. Open the event.
5. Take orders quickly.
6. Send orders to kitchen.
7. Close the event.
8. Review the day's numbers.

## One-Person Food Truck Philosophy

The primary user may be tired, interrupted, and operating in a small physical space.

Design and implementation must prioritize:

- Fast cashier operation
- Clear event setup
- Low cognitive load
- Few screens during service
- No financial or back-office clutter in POS
- Reliable central data over clever UI shortcuts

## Architecture Owner Authority

The Architecture Owner is Miles / Lin Zi-Mao.

Architecture Owner decisions override AI suggestions, inferred plans, and prior assistant preferences.

If a requested change may alter architecture, domain boundaries, contracts, schema, business rules, or workflow ownership, stop and request explicit Architecture Owner approval before implementation.

## Event-First Workflow

ROS is event-first.

The operator thinks in this order:

```text
Event
-> Products for this event
-> Inventory for this event
-> Open Event
-> POS
-> Kitchen
-> Close Event
-> Statistics
```

Do not arrange the daily operator workflow around internal code structure.

## Current Architecture Overview

Current architecture is based on strict ownership:

- Catalog: product master, categories, product versions, publish status, channel settings
- Operations: events, sellable inventory, orders, reservations, kitchen progression, closeout
- Cost: BOM, ingredients, purchase, inventory cost, future cost calculations

Current implementation uses one SQLite database with strict logical domain boundaries.

Catalog and Operations must not be merged just because their UI appears near each other.

## Current Development Status

Placeholder:

```text
Current status:
TBD by current session
```

## Current Branch

Placeholder:

```text
Current branch:
TBD by current session
```

## Current Deferred Items

Placeholder:

```text
Deferred items:
TBD by current session
```
