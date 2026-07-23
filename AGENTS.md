# ROS Working Rules

Read the following before modifying code, in this order:

1. `CONSTITUTION.md` — the highest repository rule.
2. Relevant accepted ADRs and Architecture Owner Decisions.
3. This `AGENTS.md` file.
4. AI onboarding and handover documents:
   - `docs/bootstrap/01_AI_HANDOVER.md`
   - `docs/bootstrap/02_AI_CONSTITUTION.md`
   - `docs/bootstrap/03_UI_PHILOSOPHY.md`
   - `docs/bootstrap/04_DOMAIN_RULES.md`
   - `docs/bootstrap/05_DEVELOPMENT_WORKFLOW.md`
   - `docs/bootstrap/CURRENT_AI_HANDOVER.md`
5. `README.md`, `docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_DOMAIN_OWNERSHIP.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and other relevant documentation.

`docs/bootstrap/` is AI onboarding and handover material. It cannot override `CONSTITUTION.md`, an accepted ADR, or an Architecture Owner Decision. When documents disagree, follow that precedence and correct the bootstrap material rather than weakening an architecture rule.

- Do not create new business domains.
- Do not query another domain's tables.
- Do not import another domain's internal implementation.
- Shared contracts are the only cross-domain interface.
- Put scheduler and batch coordination only in `src/server/jobs/`. Jobs may call an application service and record results, but must not execute SQL, access repositories, query Domain tables, add business rules, or operate another Domain.
- Before modifying any file under `src/shared/contracts/`, stop and ask for explicit Architecture Owner approval.
- Before any new phase, scope expansion, or contract change, stop and wait for explicit Architecture Owner approval. Never start work automatically from a prior report, roadmap item, or completed phase.
- Every Implementation Spec must begin with a Constitution Compatibility Gate containing `Reviewed ADR` and `Compatibility Result`. The gate must list every accepted ADR relevant to the approved scope before implementation begins.
- Do not implement Kafka, RabbitMQ, CQRS, message queues, microservices, or a complex event bus.
- Do not modify the Legacy project.
- Do not connect LINE, n8n, Google Sheets, or production credentials during Phase 1A.
- Phase 1C is explicitly approved for POS Order Core only: POS create/read Order APIs, immutable Order Item snapshots, Event order numbers, idempotency, atomic sellable quantity handling, audit logging, and additive Operations migrations. Do not implement payment, Kitchen, Customer/Kiosk, preorder, cancellation, refund, Sales Contract execution, Cost, jobs, or external integrations.
- Phase 1C.1 is explicitly approved under DECISIONS #006 for the POS minimal shopping cart UI only. It may consume the existing Current Event and Order APIs. Do not add or change payment, Kitchen, Customer/Kiosk, preorder, cancellation, refund, Sales Contract execution, Cost, jobs, or external integrations.
- Phase 1C-2 is explicitly approved under DECISIONS #007 for Operations Order Lifecycle, manual no-show and inventory release, Event Close, daily-report snapshot, audit, and minimal lifecycle UI only. Do not add payment, Kitchen, Customer/Kiosk, preorder, Sales Contract execution, Cost, jobs, or external integrations.
- Phase 1C.2-R is explicitly approved under DECISIONS #010 only to restore ADR-014's separate Order, Payment, and Production models, remediate the lifecycle migration, represent no-show as cancelled with a reason, and route all Event Close calls through the formal Operations lifecycle service. Do not add Payment, Kitchen, Customer/Kiosk, preorder, Sales Contract execution, Cost, jobs, or external integrations.
- Run architecture guard tests before reporting completion.
- Every implementation completion report must begin with `Approval record: DECISIONS #<identifier>` and name the corresponding Architecture Owner approval. If no identifier exists, stop and record the approval in `docs/DECISIONS.md` before reporting completion.

Keep changes small, use SQL migrations for schema changes, and update `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` when architecture or implementation changes.

Architecture Owner: Miles / 林子茂
