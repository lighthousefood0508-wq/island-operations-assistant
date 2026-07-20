# 2026-07-26 ROS Shadow Run

## Operating rule

- Legacy is the formal system of record and remains the primary ordering workflow.
- ROS is entered in parallel for each order. It must never block a Legacy transaction.
- If ROS fails, stop using ROS immediately, continue with Legacy, and do not repair code at the stall.
- Record failure time, Legacy/ROS order number if known, device, and a screenshot.

## Before opening

1. Start ROS on the Windows host and check `/health` from the host.
2. Find the host IPv4 address with `ipconfig`.
3. From POS A, POS B, and Kitchen C, open the same host: `/pos` or `/kitchen`.
4. Create/open the Event, set sellable quantities, and verify the same OPEN Event appears on all devices.
5. Create one rehearsal order and verify Kitchen receives it without refresh.

## During service

1. Enter each Legacy order into ROS POS.
2. Kitchen moves only production status: preparing, ready, served.
3. Do not use ROS to record payment or claim an Order is formally completed.
4. If quantities disagree, continue with Legacy and note the discrepancy; do not edit SQLite or browser storage.

## Closeout

1. In `/pos/statistics`, compare central order count, sold portions, remaining portions, and ledger amount with Legacy.
2. Enter cash, LINE Pay, other receipts, waste amount, and a note. Save the closeout.
3. Formal Event Close will block while confirmed/unpaid Orders remain. This is expected in Shadow Run because Payment is not implemented.
4. Record the final comparison and any mismatch for the post-run review.
