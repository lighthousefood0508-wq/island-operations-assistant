# Domain Ownership

| Authority | Owns | May publish / consume | Forbidden |
| --- | --- | --- | --- |
| Catalog | `catalog_*`: Product and Category identity, Product versions, channels, publication | Publishes Product Contract | Recipe, Measurement, Orders, purchases, inventory, cost calculation |
| Canonical Ingredient Identity Authority | Canonical `ing_<uuid>` identity; display name; `Active -> Archived` lifecycle; append-only lifecycle and rename audit; Ingredient Measurement Profile identity, binding, immutable versions, Active Profile uniqueness, historical retention | Publishes Ingredient Measurement Profile Contract; consumes Measurement validation contract | Recipe, Cost, Purchase, Supplier, Inventory, or Prototype identity duplication; reactivation; permanent deletion; merge |
| Measurement Foundation | Dimensions, stable unit codes, exact ratios, locale conversion policy, canonical normalization, conversion evidence, precision/no-rounding policy, Profile validation semantics | Publishes versioned Measurement contracts to Profile authority, Recipe, and Cost | Recipe or Cost rules, package identity, persistence ownership, Cost dependency |
| Recipe / BOM | `recipe_*`: Recipe intent, Drafts, immutable Published Versions and Lines, quantities, presentation, Standard Input/Output/Yield, canonical projection and scaling requests | Consumes Product, Ingredient Profile, and Measurement contracts; publishes Recipe boundaries | Conversion authority, purchase price, allocation, Kitchen operation, physical inventory |
| Operations | `operations_*`: Events, Event Product Plans, sellable inventory, Orders, payments, kitchen progression, Production Batches, Actual Results, Transfer/Waste/Variance raw facts | Consumes Product and Recipe boundaries; publishes Actual Result and Sales contracts | Measurement or authoritative cost calculation; direct `recipe_*` or `cost_*` access |
| Cost | `cost_*`: purchase quotes, package pricing, Accepted Purchase Evidence, normalized costing inputs, valuation, cost calculation, Allocation Evidence, Cost Snapshots and revisions | Consumes Product, Ingredient Profile, Measurement, Recipe Costing, Actual Result, and Sales contracts | Ingredient/Profile/Measurement/Recipe ownership, Production raw facts, physical inventory |
| Future Inventory | Not implemented; reserved for physical stock, movements, lots, consumption, warehouse, genealogy | Future approved contracts only | Ingredient, Recipe, Cost Snapshot, Product, Order, or Production Batch ownership |
| Shared/System | Users, roles, audit logs, settings | Infrastructure only | Business ownership |

Current source-code hosting does not determine ownership. Canonical Ingredient and Measurement code are temporarily hosted in Recipe Core.

Canonical Ingredient names are not unique identity. Equal or normalized names produce duplicate-candidate warnings only; they do not block create or rename and never authorize automatic merge. Draft references are not removed by cascade and must be explicitly changed or removed in their owning workflow.

Reference impact is assembled by an application-level coordinator over Domain-owned read ports. Canonical Ingredient Identity Authority does not query Recipe, Cost, Purchase, or Snapshot repositories. Cost Quotes are formal immutable Cost Evidence and require Archived Ingredient history to remain readable. Until Cost Snapshot persistence exists, Snapshot impact is `Unavailable`, not zero; deletion eligibility is `Indeterminate` and blocked. Canonical Ingredient Rename/Archive commands, management APIs, and the API-backed management UI/navigation are technically completed. Governance closeout for the UI remains pending until the prepared documentation is independently reviewed and separately authorized for merge. The Reference Impact Coordinator, Ingredient 003D, reactivation, deletion, and merge/alias behavior remain unauthorized.

Each formally usable Canonical Ingredient has exactly one Active Measurement Profile at any effective instant. The existing Recipe `measurementDimension` is compatibility-only until Recipe Canonical Projection replaces it.

`tw_catty` is a Measurement stable unit and always equals exactly `600 g`. Profiles and Suppliers cannot override this ratio. `包`, `袋`, `盒`, and `罐` are deferred Package Identity concepts, not Measurement Units.

Legacy `cost_ingredients`, `cost_ingredient_aliases`, and `cost_unit_conversions` are not Canonical Ingredient or Measurement authority. Browser storage and Google Sheets are never authorities. Prototype `localStorage` data is neither formal persistence nor an approved migration source.
