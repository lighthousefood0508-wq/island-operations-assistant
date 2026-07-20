# Decisions

- ROS is a new repository, not a refactor of the legacy food truck system.
- ROS uses a modular monolith and a SQLite authoritative database for the first deployment target.
- `business_id` remains present to protect tenant isolation and future productization, while v1 launches as one business.
- Admin controls catalog publication. POS, Customer, and Kitchen consume published state only.
- Google Sheets is a reporting/review integration, not the real-time operational database.
- REST is the command/query interface; SSE is the initial real-time notification transport.
- Legacy migration occurs only after new workflows have explicit acceptance and reconciliation plans.

Detailed rationale is in `docs/adr/`.
