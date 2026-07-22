# Roadmap

1. Phase 0.5: Constitution v2 alignment, contracts, and guard tests - complete.
2. Phase 1A: Catalog Admin, Product Contract publication, read-only POS proof, and repeatable E2E acceptance - complete after verification.
3. Phase 1B: Event and Sellable Inventory foundation, Product Contract v2, Event Admin, and event-scoped POS proof - complete after verification.
4. Phase 1B.1: Governance approval record and OPEN Event Product Snapshot Policy - complete after verification.
5. Phase 1C: POS Order Core - complete after verification. POS-only create/read Orders, snapshots, atomic Event sellable quantity deduction, idempotency, Event numbering, and audit logging are implemented; payment and production remain out of scope.
6. Phase 1C.1: POS Minimal UI - complete under DECISIONS #006; shopping cart and Order API submission only.
7. Phase 1C-2: Order Lifecycle - superseded by Phase 1C.2-R after GI-001 review.
8. Phase 1C.2-R: ADR-014 recovery - complete under DECISIONS #010, awaiting Architecture Owner acceptance.
9. 2026-07-26 Shadow Run MVP: central POS/Kitchen/closeout pilot on one local network - complete on an unmerged DECISIONS #013 branch, awaiting Architecture Owner acceptance.
10. 2026-07-26 External Shadow Run: protected, temporary external access to the existing Shadow Run branch - prepared on an unmerged DECISIONS #014 branch; blocked until a separate protected tunnel can be allocated without changing Legacy.
11. Realtime Synchronization Hardening: POS, Kitchen, and Statistics reconnection, polling fallback, debug visibility, and cross-device acceptance - complete on `feature/realtime-hardening` under DECISIONS #016, awaiting Architecture Owner acceptance.
12. Cloudflare Tunnel Deployment Preparation: local tooling, readiness report, non-secret templates, Owner-only authorization steps, and a credential-free Shadow Run package - complete on `feature/cloudflare-tunnel-preparation` under DECISIONS #017, awaiting Owner authorization.
13. Quick Tunnel External Verification: temporary no-Zone `trycloudflare.com` access for ROS on port 3092 - active under DECISIONS #018 for Shadow Run testing only.
14. Device Connectivity Dashboard: read-only active SSE device telemetry at `/debug/devices` - complete under DECISIONS #034 on `feature/device-connectivity-dashboard`.
15. Front Office / Back Office / Kitchen information architecture: `/pos` for staff ordering, `/kitchen` for production, and `/admin` for Catalog, Event setup, Statistics, Health, and sharing links - complete under DECISIONS #035 on `feature/front-back-office-information-architecture`.
16. Phase B-1 POS Basic Operating Loop: phone tail, POS-recorded payment method, active Orders, served Orders, and production-status Kitchen visibility - in progress under DECISIONS #037 on `feature/phase-b1-pos-operating-loop`.
17. Phase 2: Customer preorder only after Architecture Owner approval.
18. Phase 3: POS and Kitchen pilot from the same REST/SSE source.
19. Phase 4: Cost ledger and daily Sales Contract import, then Google Sheets reporting export.

Each phase requires its own acceptance test and rollback plan before advancing.
