# ADR-013: Open Event Product Snapshot Policy

## Decision

When a draft Event receives Sellable Inventory, Operations stores the supplied Product Contract v2 snapshot in `operations_product_copies` and binds the inventory row to its `productVersionId`.

After an Event is OPEN, its sellable products must be read only from Operations-owned snapshot data. Catalog republishing must not update the OPEN Event's name, category display data, price, channels, or `productVersionId`.

## Rationale

An Event is a bounded selling session. Changing its product presentation or price after opening would make a live selling surface inconsistent and would erase the fact that the Event opened with a particular published version.

## Consequence

Catalog may publish a newer Product Contract v2 at any time, but the new version is selectable only for a future draft Event. Operations must never query `catalog_*`, import Catalog internals, or call Catalog publication APIs while serving an OPEN Event.

This policy does not introduce orders, payments, Cost behavior, or Sales Contract execution.
