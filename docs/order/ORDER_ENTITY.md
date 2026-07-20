# Order Entity and Snapshots

Status: Proposed design. Field names are implementation guidance, not a migration.

## Order

| Field | Required | Sources | Purpose / Phase 1C implementation note |
| --- | --- | --- | --- |
| `orderId` | Yes | all | Immutable UUID-style Operations primary key. |
| `orderNumber` | Yes | all | Event-scoped human queue number; assigned server-side. |
| `eventId` | Yes | all | Must identify the one OPEN Event at creation. |
| `source` | Yes | all | `pos`, `kiosk`, or `preorder`. |
| `orderStatus` | Yes | all | Lifecycle only; never stores payment or Kitchen state. |
| `paymentStatus` | Yes | all | Starts `unpaid` unless a future POS payment is atomically recorded. |
| `productionStatus` | Yes | all | Starts `not_started`; no Kitchen implementation in this phase. |
| `customerName` | Optional | kiosk, preorder | POS may optionally collect it for pickup. |
| `customerContact` | Optional | preorder | Store only the minimum contact reference needed for pickup communication; define retention before implementation. |
| `pickupTime` | Optional | preorder | Requested pickup time, not a Kitchen promise. |
| `notes` | Optional | all | Customer/staff preparation note, not a product master change. |
| `subtotal` | Yes | all | Sum of item list prices before item discounts. |
| `discountTotal` | Yes | all | Starts `0`; discount rules are out of scope. |
| `grandTotal` | Yes | all | `subtotal - discountTotal`; non-negative integer money. |
| `idempotencyKey` | Yes | all | Immutable request key and payload fingerprint pairing. |
| `createdAt` | Yes | all | Server timestamp. |
| `confirmedAt` | Optional | all | Set only at `confirmed`. |
| `completedAt` | Optional | all | Set only when the customer handoff is complete. |
| `cancelledAt` | Optional | all | Set only at cancellation. |
| `cancellationReason` | Optional | all | Required for staff cancellation; customer reason policy remains open. |

Do **not** add tax, invoice number, loyalty, promotion engine, delivery address, Cost fields, or generic JSON extension fields in the first implementation. They either have no approved behavior or belong elsewhere.

## Order item snapshot

Every `OrderItem` is immutable after confirmation except narrowly defined cancellation/accounting annotations. It must be copied from the Event's Operations-owned snapshot, never from a later Catalog query.

| Field | Required now | Purpose |
| --- | --- | --- |
| `orderItemId`, `orderId` | Yes | Immutable identity and parent. |
| `productId`, `productVersionId` | Yes | Product identity and frozen published version. |
| `displayNameSnapshot`, `posNameSnapshot` | Yes | Historical display names. |
| `displayCategoryNameSnapshot` | Yes | Historical category display snapshot. |
| `unitListPrice`, `unitSellingPrice` | Yes | Money in integer minor unit; initially equal unless discount is approved. |
| `quantity`, `lineDiscount`, `lineTotal` | Yes | Financial snapshot. |
| `notes` | Optional | Line-specific preparation note. |
| `costStatus` | No, reserve only | Future Cost integration must not be designed as an Order write. |
| `unitCostSnapshot`, `bomVersionSnapshot` | No, nullable future fields only after Cost approval | Must remain absent from the first Order implementation. |

Catalog rename, price change, channel change, unpublish, or category edit must never mutate historical Order or OrderItem snapshots.

## Human-readable number

Recommended format: `{eventCode}-{sequence}` such as `20260720-night-001`. The server allocates a monotonically increasing sequence inside the same transaction as Order creation. Sequence resets for each Event; cancelled numbers remain consumed and are never reused. A future implementation should use a dedicated Operations sequence record, not `MAX(order_number)`, to remain correct under concurrent requests.
