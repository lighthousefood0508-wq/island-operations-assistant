# ADR-012: Product Contract v2 Category Display Snapshot

## Decision

Product Contract v2 adds `displayCategoryName` and `displayCategorySortOrder`. Catalog remains the owner of category data. These fields are immutable display snapshots carried with a published product version; they do not create a Category domain outside Catalog.

## Rationale

Operations needs a stable, human-readable category label and ordering when rendering an Event's sellable products. Reading `catalog_categories` from Operations would violate the domain boundary. The contract supplies only the display data Operations needs.

## Consequence

Operations stores the v2 snapshot in `operations_product_copies`. `categoryId` is still the only business identity. Product Contract v1 is historical documentation; Phase 1B APIs publish v2.
