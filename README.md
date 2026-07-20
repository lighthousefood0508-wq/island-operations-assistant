# Desert Island ROS

Desert Island Restaurant Operating System (ROS) is an isolated restaurant foundation. Read [CONSTITUTION.md](CONSTITUTION.md) before changing code. The Legacy food truck project is not imported or modified.

## Phase 1B

Catalog Admin is available at `/admin`. It creates categories, product drafts, channels, and immutable published product versions. Event Admin is available at `/admin/events`: create a draft Event, choose published products, enter planned sellable quantities, then open the Event. `/pos` reads only `GET /api/events/current/products`, and displays active `pos` products with `remainingQuantity > 0` from the one OPEN Event.

## Install and start

Requires Node.js 24 or later.

```powershell
npm install
npm run migrate
npm run dev
```

Open [Catalog Admin](http://127.0.0.1:3090/admin), [Event Admin](http://127.0.0.1:3090/admin/events), and [POS](http://127.0.0.1:3090/pos). Health is at `http://127.0.0.1:3090/health`.

## First product

1. Create an active category with a unique lowercase code.
2. Create a product, fill display name, POS short name, price, and at least one channel.
3. Save the draft, then select **發布新版本**.
4. Create a draft Event in `/admin/events`, assign a positive planned quantity to published products, and open it.
5. Open `/pos`; only `pos` products with remaining quantity in the OPEN Event appear.

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

`better-sqlite3` is isolated behind `src/shared/database/`; it enables foreign keys, WAL, and a 5-second busy timeout. Product Contract v2 and Sales Contract v1 files in `src/shared/contracts/` are frozen and require explicit Architecture Owner approval before modification.
