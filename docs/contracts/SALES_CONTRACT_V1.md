# Sales Contract v1

## Purpose

Operations is the sole producer of completed-sale facts. It writes the validated payload to `operations_sales_outbox`. Cost is the sole consumer and imports it once per day into `cost_sales_imports`, deduplicating by `salesEventId`.

## Fields

| Field | Meaning |
| --- | --- |
| `contractVersion` | Fixed value `1` |
| `salesEventId` | Immutable idempotency identity |
| `orderId` | Operations order ID, opaque to Cost |
| `eventId` | Operations event ID, opaque to Cost |
| `completedAt` | UTC ISO-8601 completion timestamp |
| `items[].productId` | Catalog product ID snapshot |
| `items[].productVersionId` | Catalog product version snapshot |
| `items[].quantity` | Positive sold quantity |
| `items[].unitPrice` | Integer TWD sales price snapshot |
| `discountAmount` | Optional integer TWD discount |
| `channel` | Optional sales channel |
| `notes` | Optional operational note |

## Rules

This contract does not contain BOMs, ingredients, inventory deductions, unit costs, or any Cost-owned result. There is no real-time delivery and no queue in v1. Cost never reads Operations order tables or writes Operations tables.

`src/shared/contracts/sales-contract.ts` is frozen. A contract change requires explicit Architecture Owner approval and a new documented compatibility plan.
