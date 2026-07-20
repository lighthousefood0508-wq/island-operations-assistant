# Domain Ownership

| Domain | Owns | Reads | Writes | Notes |
| --- | --- | --- | --- | --- |
| Catalog | categories, products, versions, channel visibility/prices | event rules | Admin only | Product version becomes immutable after publish.
| Operations | events, allocations, orders, order items, order state | catalog snapshots, availability | POS, Customer Order, Kitchen (status only) | Server validates all transitions.
| Cost & Inventory | ingredients, aliases, conversions, BOM, purchases, batches, inventory movements, waste | catalog product references | Admin/cost workflow | Reserved schema only in this foundation.
| Platform | businesses, users, roles, devices, audit logs | all domains by permission | Admin/service only | Authentication is not implemented yet.
| Integrations | external events, sync jobs, webhook idempotency | domain records | worker only | Google Sheets is downstream reporting only.

The ROS SQLite database is the intended single source of truth. Browser storage is never an authority. Google Sheets edits must not overwrite ROS transaction state; approved import jobs may create controlled changes later.
