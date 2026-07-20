# Frozen Sellable Quantity Lifecycle

```text
remainingQuantity = plannedQuantity - reservedQuantity - soldQuantity
```

| Source / action | reserved | sold | Result |
| --- | ---:| ---:| --- |
| POS create | no change | `+ quantity` | Creates `confirmed`; no reserved stage. |
| Kiosk create | `+ quantity` | no change | Creates `submitted`, `unpaid`, `not_started`; holds 10 minutes. |
| Kiosk timeout | `- quantity` | no change | Cancels with reason `timeout`; number remains consumed. |
| Kiosk payment success | `- quantity` | `+ quantity` | Changes to `confirmed`, `paid`, `queued`. |
| Preorder success | no change | `+ quantity` | Creates `confirmed`, `unpaid`, `not_started`; deadline, preorder quota, and sellable checks must all pass. |
| Cancel before `preparing` | no change | `- quantity` for confirmed, or release reserve for submitted | Quantity returns to remaining. |
| Cancel at `preparing`, `ready`, or `served` | no change | no change | No restoration; cancellation reason, actor, timestamp, and audit are required. |

Every number allocation, idempotency check, Order/item write, and guarded counter update happens in one SQLite transaction. The guarded update must require adequate remaining quantity; zero affected rows means sold-out conflict. No client-side quantity calculation, queue, or distributed lock is authoritative.

```mermaid
flowchart TD
  POS[POS create] --> POSSold[confirmed; sold plus quantity]
  Kiosk[Kiosk create] --> Reserve[submitted; reserved plus quantity]
  Reserve --> Timeout{10 minutes elapsed?}
  Timeout -->|yes| Release[timeout cancel; reserved minus quantity]
  Timeout -->|paid| KioskSold[confirmed; reserved minus quantity; sold plus quantity; queued]
  Preorder[Preorder validations pass] --> PreSold[confirmed; sold plus quantity]
```

```mermaid
flowchart TD
  Cancel[Authorised cancellation] --> Stage{production status}
  Stage -->|not_started or queued| Restore[Release reserved or reverse sold]
  Stage -->|preparing ready served| Keep[Do not restore sold]
  Keep --> Audit[Record cancelledBy, cancelledAt, reason, audit]
  Keep --> Gap[Future Waste/reporting source; no Waste Contract now]
```
