# Domain Rules

ROS uses strict ownership. A screen may combine information for the operator, but ownership must remain separated in code and data.

## Catalog Ownership

Catalog owns long-term product master data:

- Categories
- Product identity
- Product display name
- POS short name
- Price
- Description
- Channel settings
- Publish version
- Product Contract output

Catalog does not own today's sellable quantity, remaining quantity, reservations, orders, kitchen status, payment, or cost.

## Operations Ownership

Operations owns service-day operation:

- Events
- Event status
- Sellable inventory
- Planned quantity
- Remaining quantity
- Reservations
- Safety buffer
- Orders
- Order items
- Order numbers
- Kitchen production status
- Event closeout
- Operational statistics

Operations consumes published product snapshots. It must not directly edit Catalog product master data.

## Kitchen Capability Within Operations

Kitchen is an Operations-facing capability that may advance production progression for orders.

Kitchen may update production status according to approved state rules.

Kitchen must not own:

- Product master
- Price
- Inventory planning
- Payment
- Event lifecycle

## Customer Ordering Capability

Customer ordering belongs to a future customer-facing Operations flow when approved. It is not currently a separate business domain.

Customer must not bypass Operations. Customer-created orders must enter the same central Operations order path.

Customer must not create a separate order database or browser-local source of truth.

## Cost Ownership

Cost owns:

- BOM
- Ingredients
- Unit conversions
- Purchase records
- Cost inventory
- Waste cost
- Future cost calculation

Cost must not read Operations order tables directly. Cost receives approved sales facts through the Sales Contract when that flow is approved.

## Payment Capability Within Operations

The current Constitution assigns payments to Operations. Future payment-provider integration is deferred and does not create a separate business domain unless the Architecture Owner explicitly changes the Constitution.

Payment work must not be faked inside POS, Kitchen, or Catalog UI.

## Cross-Domain Rule

Domains must never be mixed.

Allowed:

```text
UI reads approved APIs
Application service calls its own repository
Domain emits or consumes approved contracts
```

Not allowed:

```text
Operations reads Catalog internals
Catalog stores event inventory
Kitchen edits order payment
Cost reads order tables
POS writes directly to SQLite
```

## Practical Rule

Before changing any behavior, answer:

```text
Which domain owns this data?
Which service owns this rule?
Is this an existing path or a duplicate path?
```

If the answer is unclear, stop.
