# Current Status

Date: 2026-07-20

Phase 1B and Phase 1B.1 are complete after verification. Phase 1B added Catalog Product Contract v2 display snapshots plus Operations Event and Sellable Inventory. Phase 1B.1 records Architecture Owner approval and freezes the OPEN Event Product Snapshot Policy: an OPEN Event reads only its Operations-owned Product Contract v2 snapshot, while a Catalog republish is selectable only by a new Event. Phase 1C-Design is complete as a documentation-only Architecture Review package; Phase 1C implementation is not approved or started. POS reads only the current Event API. SQLite uses `better-sqlite3` through a thin adapter. Playwright E2E acceptance verifies the UI catalog-to-event-to-POS flow on an isolated database.

Not implemented: authentication, users/roles UI, orders, payments, Kitchen, Customer/Kiosk, Cost/BOM/inventory behavior, Sales Contract execution, LINE/n8n/Google Sheets/OpenAI integration, receipt processing, Docker, VPS, legacy migration, and production monitoring.

The Legacy project remains read-only and unmodified. Any new phase, scope expansion, or contract change requires explicit Architecture Owner approval before work begins.
