# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is a new, isolated foundation for a restaurant operating system. It does not run, import, or modify the legacy food truck project. Read [CONSTITUTION.md](CONSTITUTION.md) before changing code.

## Foundation status

- One SQLite database with strict `catalog_*`, `operations_*`, and `cost_*` ownership boundaries
- Product Contract and daily-batch Sales Contract definitions with runtime validation
- Architecture guard tests for table, SQL, import, and infrastructure boundaries
- `GET /health`, `GET /events`, and empty `/admin`, `/pos`, `/order`, `/kitchen` entry pages
- No products, orders, payments, LINE, n8n, Google Sheets, or receipt-processing business logic yet

## Install

Requires Node.js 24 or later. The foundation uses Node's built-in `node:sqlite`; confirm its production support before a production deployment.

```powershell
npm install
```

## Start

```powershell
npm run dev
```

The local URLs are `http://127.0.0.1:3090/health`, `/admin`, `/pos`, `/order`, and `/kitchen`.

## Verification

- `npm run typecheck`: TypeScript checking
- `npm run lint`: currently the same strict TypeScript validation
- `npm test`: health, contract, and architecture guard tests
- `npm run migrate`: apply pending SQL migrations
- `npm run verify`: typecheck, lint, tests, architecture guards, and a clean migration smoke test
- `npm run dev:open`: same local development server, with the URLs shown in its server output

Contract files in `src/shared/contracts/` are frozen: their modification requires explicit approval from Miles / 林子茂.
