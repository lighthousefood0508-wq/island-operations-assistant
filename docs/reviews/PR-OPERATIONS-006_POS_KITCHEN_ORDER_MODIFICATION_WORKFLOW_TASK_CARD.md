# PR-OPERATIONS-006 — POS/Kitchen Order Modification Workflow

## Constitution Compatibility Gate

- **Approval record**: DECISIONS #096.
- **Reviewed authority**: Constitution v3; ADR-003 and ADR-014 through ADR-018;
  DECISIONS #035, #037, #087, #095; reviewed program architecture; merged
  PR-OPERATIONS-004 and PR-OPERATIONS-005 server contracts.
- **Compatibility result**: PASS as a proposed UI/realtime consumer of the
  existing Operations authority. Browser state is never official truth.
- **Status**: NOT AUTHORIZED FOR IMPLEMENTATION. It depends on separately
  authorized, reviewed, and merged PR-OPERATIONS-004 and 005.

## Single responsibility

Expose the completed replacement protocol as a safe, fast Owner workflow in POS
and a clear read-only lock/update projection in Kitchen, including cross-device
recovery, stable pickup identity, deterministic voice/reminder behavior, and
desktop/tablet operability.

## POS workflow

- `修改訂單` always loads the server's effective Order and revision.
- Operator can add/remove/change lines and production-visible notes; the screen
  clearly distinguishes onsite and scheduled Orders.
- Before prepare, show old/new line summary, old/new totals, supplement/refund,
  and per-removed-line choices for returned-to-sellable versus not-returned.
- After prepare, freeze all inputs. Display the held items, ten-minute prepared
  lease, and explicit cancel. Heartbeat renewal is advisory UI activity backed
  by server CAS; a lost browser does not own the lock.
- When external money is required, move to `external_in_progress` before showing
  the final collect/refund instruction. The screen never repeats the instruction
  after evidence is recorded.
- Any authorized POS/Admin opening an unfinished intent gets the same recovery
  view and only the three approved choices: no money, money completed, unknown.
- Unknown shows exactly: `款項狀態尚待核對，請勿再次收款或退款。`
- Failures retain recoverable server intent and safe user input where applicable;
  they never create a second intent automatically.

## Kitchen, voice, and reminder workflow

- Kitchen displays a centrally derived lock indicator and disables every
  production action for a nonterminal intent; it does not manage the intent.
- After confirmation, stable pickup number remains visible with `已修改` and
  the effective contents replace the old contents in active work.
- A ready Order whose production content changed reappears at preparing.
- New Order voice identity is `root + revision + new-order`; modified identity
  is `root + revision + order-modified`. Modification speaks once as
  `訂單 001 已修改`, not as a full new Order, and SSE replay/reconnect does not
  repeat it.
- A confirmed pickup-time change removes the old reminder identity and schedules
  the new time. Pending proposals do not announce or reschedule final behavior.

## Scope to freeze before implementation

Exact allowlist may include the existing POS/Kitchen pages, shared realtime or
voice helper only where required, existing route/access-control composition,
focused UI/API integration and Chromium E2E tests, and Architecture Guards. It
must not change schema, migration, Payment/domain rules, provider integration,
Catalog/Cost/Recipe, closeout semantics, or deployment files.

## Acceptance criteria

- Onsite and scheduled Orders can be safely modified before/after payment and
  before/after production under the server rules.
- Stable pickup number and explicit modified state are understandable; internal
  replacement identity remains unique.
- Full content, amount, disposition, actor/time, and held-stock summaries are
  readable without exposing UUID/engineering fields.
- No duplicate collect/refund prompt after reload, crash, session loss, another
  device takeover, back/forward, or SSE reconnect.
- Kitchen cannot cross a nonterminal lock and receives the confirmed effective
  Order once.
- Voice and reminders follow the exact event identities and timing rules.
- Desktop Chrome, tablet landscape, and tablet portrait have no horizontal
  overflow, ambiguous destructive action, or undersized primary controls;
  keyboard focus and non-color state cues work.

## Verification

Chromium E2E covers onsite/scheduled, unpaid/paid, not-started/preparing/ready,
supplement/refund/no-difference, 7+ lines, item/note change, full cancellation,
all dispositions, timeout/renewal, cross-device crash recovery, reconciliation,
back/forward/reload, SSE reconnect, voice/reminder dedupe, and three viewports.
Also run focused API/Operations regressions, authentication/roles/CSRF/canonical
origin/actor/strict-schema checks, Architecture Guards, typecheck, lint, build,
full tests, `pnpm run verify`, `pnpm run verify:full`, compiled collection,
migration pending smoke, diff/text/encoding/secret scans.

## Dependencies and stop conditions

PR-OPERATIONS-004 and 005 must be merged and green. Stop if the UI must invent
financial, inventory, production, or replacement truth; if recovery depends on
local/session storage; if a second command handler is required; or if live
runtime, UAT SQLite, Cloudflare, Scheduled Task, Docker, n8n, or Legacy must be
changed before the later deployment Gate.
