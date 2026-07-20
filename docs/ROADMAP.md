# Roadmap

1. Phase 0.5: Constitution v2 alignment, contracts, and guard tests - complete.
2. Phase 1A: Catalog Admin, Product Contract publication, read-only POS proof, and repeatable E2E acceptance - complete after verification.
3. Phase 1B: Event and Sellable Inventory foundation, Product Contract v2, Event Admin, and event-scoped POS proof - complete after verification.
4. Phase 1B.1: Governance approval record and OPEN Event Product Snapshot Policy - complete after verification.
5. Phase 1C: POS Order Core - complete after verification. POS-only create/read Orders, snapshots, atomic Event sellable quantity deduction, idempotency, Event numbering, and audit logging are implemented; payment and production remain out of scope.
6. Phase 1C.1: POS Minimal UI - complete under DECISIONS #006; shopping cart and Order API submission only.
7. Phase 1C-2: Order Lifecycle - superseded by Phase 1C.2-R after GI-001 review.
8. Phase 1C.2-R: ADR-014 recovery - complete under DECISIONS #010, awaiting Architecture Owner acceptance.
9. Phase 2: Customer preorder only after Architecture Owner approval.
10. Phase 3: POS and Kitchen pilot from the same REST/SSE source.
11. Phase 4: Cost ledger and daily Sales Contract import, then Google Sheets reporting export.

Each phase requires its own acceptance test and rollback plan before advancing.
