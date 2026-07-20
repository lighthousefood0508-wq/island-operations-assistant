# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is a new, isolated foundation for a restaurant operating system. It does not run, import, or modify the legacy food truck project.

## Foundation status

- Node.js + TypeScript modular monolith
- SQLite schema migrations
- `GET /health` and `GET /events` (SSE heartbeat)
- Placeholder web entry points: `/admin`, `/pos`, `/order`, `/kitchen`
- No products, orders, payments, LINE, n8n, Google Sheets, or receipt-processing business logic yet

## Local development

Requires Node.js 24 or later and pnpm. The foundation uses Node's built-in `node:sqlite`; confirm its production support before a production deployment.

```powershell
pnpm install
pnpm run db:migrate
pnpm run dev
```

Open `http://127.0.0.1:3090/health`. The other foundation routes are `/admin`, `/pos`, `/order`, and `/kitchen`.

## Scripts

- `pnpm run typecheck`: TypeScript checking
- `pnpm run lint`: currently the same strict TypeScript validation
- `pnpm run test`: health endpoint test
- `pnpm run build`: compile to `dist/`
- `pnpm run db:migrate`: apply pending SQL migrations
- `pnpm run dev`: compile and run local server with file watch

Read [docs/00_PROJECT_VISION.md](docs/00_PROJECT_VISION.md) before extending the system.
