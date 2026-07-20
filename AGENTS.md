# ROS Working Rules

Read `CONSTITUTION.md` before modifying code. Then read `README.md`, `docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_DOMAIN_OWNERSHIP.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and relevant ADRs.

- Do not create new business domains.
- Do not query another domain's tables.
- Do not import another domain's internal implementation.
- Shared contracts are the only cross-domain interface.
- Put scheduler and batch coordination only in `src/server/jobs/`. Jobs may call an application service and record results, but must not execute SQL, access repositories, query Domain tables, add business rules, or operate another Domain.
- Before modifying any file under `src/shared/contracts/`, stop and ask for explicit Architecture Owner approval.
- Do not implement Kafka, RabbitMQ, CQRS, message queues, microservices, or a complex event bus.
- Do not modify the Legacy project.
- Do not connect LINE, n8n, Google Sheets, or production credentials during Phase 1A.
- Only the Phase 1A Catalog Admin, Product Contract publication, and read-only POS proof are approved. Do not implement Operations, Cost, ordering, Kitchen, or jobs.
- Run architecture guard tests before reporting completion.

Keep changes small, use SQL migrations for schema changes, and update `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` when architecture or implementation changes.

Architecture Owner: Miles / 林子茂
