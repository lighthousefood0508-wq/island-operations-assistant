# ADR-019: Recipe, Measurement, and Cost Authority

Status: Accepted

Decision owner: Miles / Lin Zi-Mao

Approval records: DECISIONS #048, #053, #056, #058, #059, and #069

## Context

ADR-007 established early table and contract isolation but assigned BOM, Ingredient, and unit conversion authority to Cost. Later Recipe and Cost design proved that Recipe, Operations, and Cost need the same immutable Ingredient and Measurement facts without making Cost the source of Recipe or Measurement truth.

Legacy `cost_boms`, `cost_ingredients`, and `cost_unit_conversions` are foundation skeletons. Their names and storage types do not establish current authority.

## Decision

- Recipe / BOM is the sole Recipe authority.
- Canonical Ingredient Identity Authority owns `ing_<uuid>` identity and Ingredient Measurement Profile identity, binding, lifecycle, immutable versions, Active uniqueness, and history.
- Measurement Foundation owns dimensions, stable unit identity, exact conversions, locale policy, normalization, evidence, precision/no-rounding, and Profile validation semantics.
- Operations owns service and Production Batch raw facts.
- Cost owns Quotes, purchase evidence, normalized costing inputs received through approved contracts, valuation, calculation, allocation evidence, and Cost Snapshots.

Canonical Ingredient and Measurement capabilities are currently hosted in Recipe Core. Hosting does not make them Recipe-owned and must not change the published contract boundary.

Recipe, Cost, Purchase, Supplier, Inventory, and Prototype code must not establish a second Canonical Ingredient authority. Browser `localStorage` and legacy Cost Ingredient tables are not formal Ingredient persistence or authority.

Recipe and Cost must not create independent Measurement conversion authority. The existing Recipe `measurementDimension` is compatibility-only until Recipe Canonical Projection replaces it. Legacy Cost Ingredient and conversion tables are non-authoritative.

At any effective instant, each formally usable Canonical Ingredient has exactly one Active Measurement Profile. Profile revisions use immutable Profile Version IDs. Ingredient archival retains Profiles and historical evidence.

`tw_catty` always equals exactly `600 g` under Measurement authority. Locale may resolve `斤` to `tw_catty`, but Profile, Supplier, Recipe, and Cost cannot override the ratio.

Package Identity and Package Specification are deferred. `包`, `袋`, `盒`, and `罐` are not Measurement Units.

## Canonical Ingredient lifecycle

- The only approved lifecycle transition is `Active -> Archived`.
- Reactivation (`Archived -> Active`), permanent deletion, and Ingredient merge are not approved.
- Rename preserves Ingredient ID and creates append-only audit evidence. It does not rewrite historical Cost Evidence, Published Recipe Versions, Accepted Purchase Evidence, or future Cost Snapshots.
- Equal or normalized names are duplicate-candidate warnings only. They do not block create or rename, establish identity, or authorize automatic merge.
- Draft references are not removed by cascade. Users must explicitly remove or change them in the owning workflow.
- Cost Quotes are formal immutable Cost Evidence. Archived Ingredient identity and display history remain readable to all formal historical references.

## Reference impact boundary

An application-level coordinator composes Domain-owned read ports to report Accepted Purchase, Published Recipe or BOM, Cost Quote, future Cost Snapshot, and Draft reference impact. Canonical Ingredient Identity Authority must not query Recipe, Cost, Purchase, or Snapshot repositories directly.

Until Cost Snapshot persistence is implemented, Snapshot reference status is `Unavailable`, not zero. Any deletion eligibility depending on Snapshot impact is `Indeterminate` and blocked. This ADR approves the boundary and status semantics only; it does not authorize the coordinator, read ports, API, UI, or persistence implementation.

## Dependency direction

- Measurement Foundation publishes contracts to Recipe and Cost.
- Canonical Ingredient Identity Authority publishes the Ingredient Measurement Profile contract to Recipe and Cost.
- Recipe publishes Recipe Measurement / Scaling and Recipe Costing contracts.
- Operations publishes Production Actual Result and approved Sales contracts to Cost.

Consumers do not query publisher tables or import publisher internals.

## Consequences

- Approved business prefixes remain `catalog_*`, `recipe_*`, `operations_*`, and `cost_*`.
- Existing Measurement Foundation v1 exact evidence remains stable.
- Published Recipe, Profile, Production, and Cost history remains immutable according to its lifecycle boundary.
- Ingredient lifecycle UI, API, application coordination, and persistence changes require separate implementation authorization.
- Prototype Ingredient data remains non-authoritative and must not be described as completed ROS persistence.
- Schema, migration, persistence, runtime integration, Package conversion, density, yield, waste, and PR-MEASURE-002 implementation require separate authorization.

## Supersession

This ADR supersedes ADR-007 wherever ADR-007 describes only two business domains, assigns Recipe or Measurement authority to Cost, limits business prefixes to three, or treats Product Contract and Sales Contract as the exhaustive cross-domain interface list. ADR-007 remains historical evidence for the original boundary decision.
