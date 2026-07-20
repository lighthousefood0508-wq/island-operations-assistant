# Order Entity and Immutable Item Snapshot

Status: Frozen design policy, not a migration.

| Field | Required | Notes |
| --- | --- | --- |
| `orderId` | Yes | Immutable Operations primary key. |
| `orderNumber` | Yes | `{eventCode}-{sequence}`; all sources share one Event sequence; never reused. |
| `eventId`, `source` | Yes | `source` is `pos`, `kiosk`, or `preorder`; it never changes number format. |
| `orderStatus`, `paymentStatus`, `productionStatus` | Yes | Separate frozen state fields. |
| `customerName`, `customerContact`, `pickupTime`, `notes` | Optional | Contact retention and preorder cancellation remain open policy questions. |
| `subtotal`, `discountTotal`, `grandTotal` | Yes | Integer money snapshots; discounts remain out of first implementation scope. |
| `idempotencyKey`, `payloadFingerprint` | Yes | Required to make retry behavior deterministic. |
| `createdAt`, `confirmedAt`, `completedAt`, `cancelledAt` | As applicable | Server times. |
| `cancelledBy`, `cancellationReason` | Required on cancellation | Required especially after production begins; always audited. |

Do not add invoice, tax, loyalty, delivery, Cost, BOM, generic JSON, or promotion fields in the first implementation.

## Item snapshot

| Field | Required | Purpose |
| --- | --- | --- |
| `orderItemId`, `orderId` | Yes | Immutable item identity and parent. |
| `productId`, `productVersionId` | Yes | Event snapshot identity. |
| `displayNameSnapshot`, `posNameSnapshot`, `displayCategoryNameSnapshot` | Yes | History survives Catalog changes. |
| `unitListPrice`, `unitSellingPrice`, `quantity`, `lineDiscount`, `lineTotal` | Yes | Integer monetary and quantity snapshot. |
| `notes` | Optional | Per-item preparation note. |
| `costStatus`, `unitCostSnapshot`, `bomVersionSnapshot` | No | Not part of first Order implementation; Cost remains separate. |

Catalog rename, price update, unpublish, category edit, or later product version must never change an Order Item snapshot.
