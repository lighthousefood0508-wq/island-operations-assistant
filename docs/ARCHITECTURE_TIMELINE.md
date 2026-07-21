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
| Phase 1C-2 | Superseded by remediation | 2026-07-20 | Original lifecycle implementation reviewed under GI-001; DECISIONS #007 |
| Phase 1C.2-R | Complete, awaiting acceptance | 2026-07-20 | ADR-014 state separation recovery, idempotent data recovery migration, no-show cancellation reason, unified Event Close, and compatibility gate; DECISIONS #010 |
| 2026-07-26 Shadow Run MVP | Complete, unmerged, awaiting acceptance | 2026-07-20 | Central SQLite POS/Kitchen synchronization, SSE refresh, production-only Kitchen, and minimal closeout reconciliation; DECISIONS #013 |
| 2026-07-26 External Shadow Run | Prepared, unmerged, externally blocked | 2026-07-20 | Protected temporary ngrok access, same-origin SSE validation, connectivity state, and external-device instructions; blocked because Legacy owns the only current ngrok endpoint; DECISIONS #014 |

No future phase starts automatically. A new phase, scope expansion, or contract change requires explicit Architecture Owner approval before implementation begins.
