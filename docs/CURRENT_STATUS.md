# Current Status

Date: 2026-07-20

Phase 1B is complete after verification: Catalog publishes Product Contract v2 with approved category display snapshots. Operations owns Event and Sellable Inventory records, stores its own published-product copy, and exposes the current OPEN Event plus its remaining sellable products through read-only APIs. POS now reads only the current Event API. SQLite uses `better-sqlite3` through a thin adapter. Playwright E2E acceptance verifies the UI catalog-to-event-to-POS flow on an isolated database.

Not implemented: authentication, users/roles UI, orders, payments, Kitchen, Customer/Kiosk, Cost/BOM/inventory behavior, Sales Contract execution, LINE/n8n/Google Sheets/OpenAI integration, receipt processing, Docker, VPS, legacy migration, and production monitoring.

The Legacy project remains read-only and unmodified. The next phase requires Architecture Owner approval.
