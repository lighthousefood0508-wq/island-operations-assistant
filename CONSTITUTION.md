# Desert Island ROS Architecture Constitution v3

This document is the highest architecture rule for ROS. It supersedes earlier architecture documents where they conflict. ADR-019 and DECISIONS #048, #053, and #056 record the Architecture Owner approvals reflected by this version.

## Exclusive ownership

ROS is a modular monolith. Every business fact has exactly one authoritative owner.

1. **Catalog** owns Product and Category identity, Product versions, channel settings, publishing status, and approved Product Contract projections.
2. **Canonical Ingredient Identity Authority** owns the canonical `ing_<uuid>` identity, Ingredient Measurement Profile identity, Ingredient-to-Profile binding, Profile lifecycle and immutable Profile Versions, Active Profile uniqueness, and Profile historical retention. Its current source-code host is Recipe Core; hosting does not make these facts Recipe-owned.
3. **Measurement Foundation** owns measurement dimensions, stable measurement unit identity, exact conversion ratios, locale conversion policy, canonical quantity normalization, exact conversion evidence, precision and no-rounding policy, and Measurement Profile validation semantics. Its current source-code host is Recipe Core; hosting does not make Measurement part of the Recipe Domain.
4. **Recipe / BOM** is the only authoritative Recipe source. It owns Recipe ingredient intent, Recipe Drafts, immutable Published Recipe Versions and Lines, Recipe quantities and presentation, Standard Input, Standard Output, Standard Yield, canonical projection requests, scaling requests, and Recipe version history.
5. **Operations** owns Events, Event Product Plans, sellable inventory, Orders, payments, kitchen progression, Production Batches, confirmed Actual Results, Primary Outputs, Transfer Outputs, Waste and Variance raw facts, and their revision or supersession history.
6. **Cost** owns purchase quotes, package pricing, Accepted Purchase Evidence, normalized costing inputs received through approved contracts, Ingredient Valuation, cost calculation, Allocation Policy and Evidence, Cost Snapshots, and Snapshot revisions.
7. A future **Inventory** domain may own physical stock, movements, lots, remaining material, actual consumption, warehousing, and material genealogy only after separate Architecture Owner approval.

Recipe and Cost must not define independent Measurement unit or conversion authority. Measurement must not depend on Cost. Recipe must not depend on Cost. Operations does not calculate authoritative cost, and Cost does not own Recipe or Production Batch raw facts.

## Measurement and Ingredient Profile policy

- Each formally usable Canonical Ingredient has exactly one Active Ingredient Measurement Profile at any effective instant.
- A Profile has one immutable Profile ID and each revision has one immutable Profile Version ID. v1 does not use a human-readable version number as authority.
- An Active Profile has exactly one measurement dimension and canonical unit: mass uses `g`, volume uses `ml`, and count uses `each`.
- Measurement owns GLOBAL and LOCALE unit interpretation. Profile-specific aliases may supplement an Ingredient but must resolve to an approved stable unit and must not define a conversion ratio.
- Locale may determine whether the text `斤` resolves to `tw_catty`; once resolved, `tw_catty` always equals exactly `600 g`. Profile, Supplier, Recipe, and Cost may not override that ratio.
- `包`, `袋`, `盒`, and `罐` are reserved future Package Identity and Package Specification concepts. They are not Measurement Units, and Measurement Profile v1 does not own or infer package contents.
- Archiving an Ingredient does not delete or mutate its Profiles and does not invalidate historical Measurement evidence. Historical replay uses the pinned Profile Version and conversion evidence.
- The existing Recipe `measurementDimension` field is compatibility-only until Recipe Canonical Projection replaces it. It is not a second Measurement authority.

## Storage, namespace, and boundaries

- ROS v1 uses one SQLite database with approved business prefixes `catalog_*`, `recipe_*`, `operations_*`, and `cost_*`.
- `inventory_*` is reserved and prohibited until a future Inventory domain is explicitly approved.
- Current hosting location and database location do not determine architectural ownership.
- A domain must never query or write another domain's tables or import another domain's internal implementation.
- Cross-domain access uses only approved identities, explicit-version Contracts, and read boundaries.
- Legacy `cost_ingredients`, `cost_ingredient_aliases`, and `cost_unit_conversions` are not Canonical Ingredient or Measurement authority. In particular, a legacy `REAL` multiplier is not exact conversion evidence.
- Admin is the only Catalog writer. POS and Kitchen cannot write Product, Ingredient, Recipe, Measurement, or Cost authority.
- Any new domain, shared ownership, or ownership transfer requires explicit Architecture Owner approval.

## Approved contract directions

- Catalog publishes Product Contract projections to approved consumers.
- Measurement Foundation publishes versioned Measurement contracts to Recipe and Cost.
- Canonical Ingredient Identity Authority publishes the versioned Ingredient Measurement Profile boundary to Recipe and Cost.
- Recipe publishes versioned Recipe Measurement / Scaling and Recipe Costing boundaries.
- Operations publishes the versioned Production Actual Result boundary to Cost.
- Operations publishes Sales Contract where separately approved.

The reverse directions are not implied. Consumers must not import a publisher's internals or read its tables. Every cross-domain payload identifies its contract name and version. Modifying a frozen contract still requires explicit Architecture Owner approval.

## Exact numeric evidence

Authoritative Measurement values follow `docs/05_EXACT_NUMERIC_POLICY.md`.

- Floating-point values and SQLite `REAL` are prohibited as Measurement conversion authority.
- Decimal quantities use a signed 64-bit coefficient and integer scale from 0 through 6.
- Exact conversion ratios use positive reduced signed-64-bit numerator and denominator evidence.
- Measurement Foundation v1 performs no silent rounding. A non-exact, unsupported-scale, or overflow result fails closed.
- Recipe and Cost cannot select their own Measurement rounding behavior.
- Historical evidence preserves the exact conversion identity, version, numerator, and denominator used.

## Historical truth

- Published Recipe Versions, Active Ingredient Measurement Profile Versions once used as formal evidence, Confirmed Production Batch Actual Results, Accepted Purchase Evidence, Allocation Evidence, and Cost Snapshots are immutable historical evidence.
- Draft data may be edited until its explicit activation, confirmation, or publication boundary.
- Corrections use a new version, revision, or supersession record with actor, timestamp, and reason. Historical evidence is never silently recalculated.
- Standard Cost basis and Actual Cost basis remain distinct and never overwrite one another.
- Actual Yield belongs to Operations evidence. It must not mutate Recipe Standard Yield.

## Legacy Cost BOM disposition

`cost_boms` and `cost_bom_items` are deprecated, non-authoritative skeletons.

- They are not a Recipe source and must receive no new dependency or writes.
- They are not dropped, renamed, or migrated by governance synchronization.
- Any mapping, replacement, or removal requires a separate data audit, Owner decision, and forward-only migration.

Legacy Cost inventory and unit tables do not become Inventory, Ingredient, Measurement, Recipe, or Cost Snapshot authority merely because they exist.

## Jobs and coordination

- Schedulers and coordinators live only under `src/server/jobs/`.
- A job may coordinate timing, call an application service, and record a result.
- A job must not execute SQL, access repositories directly, contain business rules, or operate another Domain.
- The allowed path is `server/jobs -> application service -> domain-owned port -> infrastructure`.

## Explicitly prohibited without separate approval

Kafka, RabbitMQ, message queues, CQRS, microservices, complex event buses, complete Production planning, Inventory or Warehouse implementation, lot tracking, material genealogy, package conversion, density conversion, variable-weight packages, yield or waste conversion, AI-inferred Measurement facts, NRV allocation, labor or overhead allocation, Google Sheets as a source database, Legacy integration, and production credentials.

Architecture Owner: Miles / Lin Zi-Mao
