# Audit Log

`audit_logs` is append-only. Phase 1C-2 records `order_created`, `status_changed`, `no_show`, `inventory_released`, and `event_closed` with timestamp, semantic operator, order/event identity, and safe metadata. No audit row is updated or deleted by lifecycle operations.
