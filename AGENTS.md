# ROS Working Rules

Before changing ROS, read in order: `README.md`, `docs/00_PROJECT_VISION.md`, `docs/02_SYSTEM_ARCHITECTURE.md`, `docs/03_DOMAIN_OWNERSHIP.md`, `docs/CURRENT_STATUS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, and relevant ADRs.

Keep the legacy project read-only unless a future task explicitly names and authorizes a legacy change. Do not copy credentials, n8n exports, runtime databases, or UI code into ROS. Keep changes small, migrate schema through SQL files, test before reporting, and update `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, and `docs/CHANGELOG.md` when architecture or implementation changes.
