# Architecture Timeline

| Phase | Status | Architecture Owner approval | Scope |
| --- | --- | --- | --- |
| Phase 0.5 | Complete | 2026-07-20 | Constitution v2, domain boundaries, contract guardrails |
| Phase 1A | Complete | 2026-07-20 | Catalog Admin, immutable product versions, Product Contract v1, POS proof |
| Phase 1B | Complete | 2026-07-20 | Product Contract v2, Event, Sellable Inventory, Event-scoped POS |
| Phase 1B.1 | Complete | 2026-07-20 | Governance record and OPEN Event snapshot freeze |
| Phase 1C-Design | Complete (design only) | 2026-07-20 | Order Domain design package and policy freeze |
| Phase 1C | Complete | 2026-07-20 | POS-only Order Core: snapshots, atomic quantity deduction, Event number, idempotency, audit, and create/read API |
| Release v0.4 | Released locally | 2026-07-20 | Catalog, Event, Sellable Inventory, and POS Order Core (`v0.4-order-core`) |
| Phase 1C.1 | Complete | 2026-07-20 | POS minimal shopping cart UI, existing Order API submission, refresh, and UI race acceptance; DECISIONS #006 |
| Phase 1C-2 | Complete, awaiting acceptance | 2026-07-20 | Operations lifecycle, manual no-show/release, Event Close, daily report, audit, and lifecycle UI; DECISIONS #007 |

No future phase starts automatically. A new phase, scope expansion, or contract change requires explicit Architecture Owner approval before implementation begins.
