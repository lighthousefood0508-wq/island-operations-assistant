# Legacy Audit Boundary

Reference reviewed: the legacy project's architecture/status/handoff documents and its known POS, Kitchen, Customer, LINE, n8n, Google Sheets, ngrok, and Windows automation landscape.

Legacy strengths to preserve conceptually: separate operational views, LINE-assisted cost workflows, pending receipt review, and Google Sheets reporting. Legacy risks this project addresses: browser-local and duplicated state, fragile cross-device synchronization, operational code mixed with automation, and integrations acting as data owners.

This ROS repository copies no legacy UI, configuration, Docker files, scripts, credentials, n8n exports, Google Sheets data, or runtime SQLite data. Migration is a future explicit phase with reconciliation and rollback.
