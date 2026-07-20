# ROS Working Rules

Read `CONSTITUTION.md` before modifying code. Then read `README.md`, `docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_DOMAIN_OWNERSHIP.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and relevant ADRs.

- Do not create new business domains.
- Do not query another domain's tables.
- Do not import another domain's internal implementation.
- Shared contracts are the only cross-domain interface.
- Before modifying any file under `src/shared/contracts/`, stop and ask for explicit Architecture Owner approval.
- Do not implement Kafka, RabbitMQ, CQRS, message queues, microservices, or a complex event bus.
- Do not modify the Legacy project.
- Do not connect LINE, n8n, Google Sheets, or production credentials during Phase 0.5.
- Do not start Phase 1 features without approval.
- Run architecture guard tests before reporting completion.

Keep changes small, use SQL migrations for schema changes, and update `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` when architecture or implementation changes.

Architecture Owner: Miles / 林子茂
