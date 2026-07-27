-- Staff-created scheduled pickup Orders remain POS Orders in Operations.
-- NULL means an ordinary onsite Order.

ALTER TABLE operations_orders
  ADD COLUMN scheduled_pickup_at TEXT;

CREATE INDEX IF NOT EXISTS operations_orders_event_scheduled_pickup
  ON operations_orders(event_id, scheduled_pickup_at);
