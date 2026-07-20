# Cancellation, Refund, and Availability

Cancellation changes the Order lifecycle. Refund changes money. Payment void changes a payment attempt. Availability restoration changes Event counters. They are related but never synonymous.

| Situation | Order | Payment | Production | Quantity | Authority / audit |
| --- | --- | --- | --- | --- | --- |
| Unpaid submitted cancellation | `cancelled` | remains `unpaid` | `cancelled` | release reserved | Kiosk customer within policy, POS, Admin; reason + actor + timestamp. |
| Paid, not started cancellation | `cancelled` | refund/void recorded separately | `cancelled` | reverse sold allocation | POS/Admin; payment reference, refund amount, reason. |
| Preparing/ready cancellation | `cancelled` or exception outcome | refund policy separate | `cancelled` with production note | do not restore by default | Admin/POS; reason, actor, time, preparation stage. |
| Served/completed partial refund | normally remains `completed` | `partially_refunded` | `served` | never restore | Admin only; amount and reason. |
| Full refund after completed | normally remains `completed` | `refunded` | `served` | never restore | Admin only; refund reference and reason. |

The first implementation should support only the first two rows unless Architecture Owner approves exception handling. Every state-changing action must append an Operations audit event with before/after states, actor, reason, timestamp, and payment reference when applicable.
