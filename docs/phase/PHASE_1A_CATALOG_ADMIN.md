# Phase 1A: Catalog Admin

## Scope

This phase implements only Catalog categories, product drafts, immutable published product versions, channels (`pos`, `kiosk`, `preorder`), Product Contract publication, minimal Admin UI, and read-only POS display.

## Publish path

Admin saves a draft -> Catalog validates category/name/POS name/price/channels -> immutable version -> audit log -> Product Contract v1 -> public read-only API -> POS reads `channel=pos`.

## Exclusions

No login, ordering, payment, Kitchen, Customer/Kiosk behavior, Operations implementation, Cost implementation, BOM, inventory, Sales Contract execution, LINE, n8n, Google Sheets, or legacy integration.
