# Product Contract v2

Architecture Owner approved this version for Phase 1B on 2026-07-20.

Catalog publishes Product Contract v2. Operations and Cost may only consume this public snapshot; they must not query `catalog_*` tables.

```ts
{
  contractVersion: "2",
  productId: string,
  productVersionId: string,
  categoryId: string,
  displayCategoryName: string,
  displayCategorySortOrder: number,
  displayName: string,
  posName: string,
  sellingPrice: number,
  channels: string[],
  isActive: boolean,
  publishedAt: string
}
```

`displayCategoryName` and `displayCategorySortOrder` are display snapshots only. `categoryId` remains the sole category business identity. The contract never includes BOM, ingredients, cost, inventory, purchases, or order information.

Changing this contract requires explicit Architecture Owner approval, a new compatible version, runtime validation, tests, documentation, and rollout notes.
