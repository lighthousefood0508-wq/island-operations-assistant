# ROS Working Rules

Read `CONSTITUTION.md` before modifying code. Then read `README.md`, `docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_DOMAIN_OWNERSHIP.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and relevant ADRs.

- Do not create new business domains.
- Do not query another domain's tables.
- Do not import another domain's internal implementation.
- Shared contracts are the only cross-domain interface.
- Put scheduler and batch coordination only in `src/server/jobs/`. Jobs may call an application service and record results, but must not execute SQL, access repositories, query Domain tables, add business rules, or operate another Domain.
- Before modifying any file under `src/shared/contracts/`, stop and ask for explicit Architecture Owner approval.
- Before any new phase, scope expansion, or contract change, stop and wait for explicit Architecture Owner approval. Never start work automatically from a prior report, roadmap item, or completed phase.
- Do not implement Kafka, RabbitMQ, CQRS, message queues, microservices, or a complex event bus.
- Do not modify the Legacy project.
- Do not connect LINE, n8n, Google Sheets, or production credentials during Phase 1A.
- Phase 1C is explicitly approved for POS Order Core only: POS create/read Order APIs, immutable Order Item snapshots, Event order numbers, idempotency, atomic sellable quantity handling, audit logging, and additive Operations migrations. Do not implement payment, Kitchen, Customer/Kiosk, preorder, cancellation, refund, Sales Contract execution, Cost, jobs, or external integrations.
- Phase 1C.1 is explicitly approved under DECISIONS #006 for the POS minimal shopping cart UI only. It may consume the existing Current Event and Order APIs. Do not add or change payment, Kitchen, Customer/Kiosk, preorder, cancellation, refund, Sales Contract execution, Cost, jobs, or external integrations.
- Run architecture guard tests before reporting completion.
- Every implementation completion report must begin with `Approval record: DECISIONS #<identifier>` and name the corresponding Architecture Owner approval. If no identifier exists, stop and record the approval in `docs/DECISIONS.md` before reporting completion.

Keep changes small, use SQL migrations for schema changes, and update `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` when architecture or implementation changes.

Architecture Owner: Miles / 林子茂
