# Phase 1B Event and Sellable Inventory Acceptance

Estimated time: 5 minutes. This validates only Event, Sellable Inventory, current Event API, and read-only POS. It does not submit an Order.

## Checklist

| Step | Expected result |
| --- | --- |
| Create a draft Event | Event has code, name, date, start/end time, and `draft` status. |
| Allocate a published POS product | Planned quantity persists; remaining equals planned. |
| Open the Event | Event becomes the only `open` Event. |
| Check `/pos` on two browsers/devices | Both display only the open Event's POS-enabled product and remaining quantity. |
| Republish the Catalog product with a changed price | The open Event and POS retain the selected old product snapshot. |
| Close the Event | `/api/events/current/products` and `/pos` show no sellable product. |

## Automated evidence

`tests/operations-events.test.ts`, `tests/operations-events-api.integration.test.ts`, and the first Playwright scenario in `tests/e2e/catalog-publish-to-pos.spec.ts` execute this path on isolated SQLite databases. The latest Phase 1C verification reran all three successfully.
