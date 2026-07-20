# Product Contract v1

## Purpose

Catalog produces this immutable published-product contract. Operations and Cost may read it, but neither may alter Catalog or use it to receive BOM, ingredient, cost, inventory, or purchase data.

## Fields

| Field | Meaning |
| --- | --- |
| `contractVersion` | Fixed value `1` |
| `productId` | Stable Catalog product ID |
| `productVersionId` | Stable published version ID |
| `categoryId` | Catalog category ID |
| `displayName` | Customer-visible name |
| `posName` | POS-friendly display name |
| `sellingPrice` | Integer TWD selling price |
| `channels` | Enabled sales channels |
| `isActive` | Published availability state |
| `publishedAt` | UTC ISO-8601 publication timestamp |

## Rules

Runtime validation rejects unknown fields and unsupported versions. `src/shared/contracts/product-contract.ts` is frozen. A contract change requires an Architecture Owner approval, a new documented version, compatibility assessment, guard/test updates, and an approved migration plan.

Architecture Owner: Miles / 林子茂
