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

## Canonical Ingredient and Measurement Authority

Canonical Ingredient Identity Authority owns:

- Canonical `ing_<uuid>` identity
- Ingredient Measurement Profile identity and binding
- Profile lifecycle and immutable versions
- Active Profile uniqueness
- Profile historical retention

Measurement Foundation owns:

- Measurement dimensions
- Stable unit identity
- Exact conversion ratios
- Locale conversion policy
- Canonical normalization and exact evidence
- Precision and no-rounding policy
- Measurement Profile validation semantics

Both capabilities are currently hosted in Recipe Core. Hosting does not make them Recipe-owned.

`tw_catty` always equals exactly `600 g` under Measurement authority. Profile, Supplier, Recipe, and Cost cannot override it. Package identities such as `包`, `袋`, `盒`, and `罐` are deferred Package Specification concepts, not Measurement Units.

## Recipe Ownership

Recipe owns Recipe ingredient intent, Recipe quantities and presentation, immutable Published Recipe Versions, Standard Input/Output/Yield, and canonical projection and scaling requests. Recipe must not define independent Measurement conversion authority.

The existing Recipe `measurementDimension` field is compatibility-only until Recipe Canonical Projection replaces it.

## Cost Ownership

Cost owns:

- Purchase quotes and package pricing
- Accepted Purchase Evidence
- Normalized costing inputs received through approved contracts
- Ingredient valuation and cost calculation
- Allocation evidence
- Cost Snapshots and revisions

Cost must not own Canonical Ingredient identity, Measurement Profiles, Measurement conversion authority, Recipe truth, or physical inventory. Cost must not read Operations order tables directly and receives only approved contract facts.

Legacy Cost Ingredient and unit-conversion tables are not Canonical Ingredient or Measurement authority.

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
Recipe and Cost consume published Measurement and Ingredient Profile contracts
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
