# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is an isolated restaurant foundation. Read [CONSTITUTION.md](CONSTITUTION.md) before changing code. The Legacy food truck project is not imported or modified.

## Phase 1A

Catalog Admin is available at `/admin`. It creates categories, product drafts, channels, and immutable published product versions. `/pos` is a read-only proof that loads published `pos` products from the Product Contract API.

## Install and start

Requires Node.js 24 or later.

```powershell
npm install
npm run migrate
npm run dev
```

Open [Admin](http://127.0.0.1:3090/admin) and [POS](http://127.0.0.1:3090/pos). Health is at `http://127.0.0.1:3090/health`.

## First product

1. Create an active category with a unique lowercase code.
2. Create a product, fill display name, POS short name, price, and at least one channel.
3. Save the draft, then select **發布新版本**.
4. Open `/pos`; only active, published products with the `pos` channel appear.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run verify`
- `npm run migrate`
- `npm run test:e2e`: isolated Chromium UI acceptance on port `3091`
- `npm run test:e2e:headed`: same E2E test with a visible browser
- `npm run test:e2e:ui`: Playwright UI mode
- `npm run verify:full`: quick verification plus E2E acceptance

E2E runs use only `data/e2e-test.sqlite`, start their own server on `127.0.0.1:3091`, and remove the test database when finished. The development database and the `3090` server are never reused. Open `playwright-report/index.html` after a run for the HTML report; failure artifacts are saved under `test-results/`. Both paths are ignored by Git.

`better-sqlite3` is isolated behind `src/shared/database/`; it enables foreign keys, WAL, and a 5-second busy timeout. Contract files in `src/shared/contracts/` are frozen and require explicit Architecture Owner approval before modification.
