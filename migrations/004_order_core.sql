ALTER TABLE operations_orders ADD COLUMN order_number TEXT;
ALTER TABLE operations_orders ADD COLUMN source TEXT;
ALTER TABLE operations_orders ADD COLUMN order_status TEXT;
ALTER TABLE operations_orders ADD COLUMN payment_status TEXT;
ALTER TABLE operations_orders ADD COLUMN production_status TEXT;
ALTER TABLE operations_orders ADD COLUMN customer_name TEXT;
ALTER TABLE operations_orders ADD COLUMN customer_contact TEXT;
ALTER TABLE operations_orders ADD COLUMN notes TEXT;
ALTER TABLE operations_orders ADD COLUMN request_fingerprint TEXT;
ALTER TABLE operations_orders ADD COLUMN confirmed_at TEXT;
ALTER TABLE operations_orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE operations_orders ADD COLUMN cancellation_reason TEXT;

ALTER TABLE operations_order_items ADD COLUMN pos_name_snapshot TEXT;
ALTER TABLE operations_order_items ADD COLUMN display_category_name_snapshot TEXT;
ALTER TABLE operations_order_items ADD COLUMN unit_list_price INTEGER;
ALTER TABLE operations_order_items ADD COLUMN unit_selling_price INTEGER;
ALTER TABLE operations_order_items ADD COLUMN line_discount INTEGER;
ALTER TABLE operations_order_items ADD COLUMN notes TEXT;
ALTER TABLE operations_order_items ADD COLUMN unit_cost_snapshot INTEGER;
ALTER TABLE operations_order_items ADD COLUMN bom_version_snapshot TEXT;
ALTER TABLE operations_order_items ADD COLUMN cost_status TEXT;
ALTER TABLE operations_order_items ADD COLUMN created_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS operations_orders_event_order_number_unique
  ON operations_orders(event_id, order_number)
  WHERE order_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_event_order_sequences (
  event_id TEXT PRIMARY KEY REFERENCES operations_events(event_id),
  next_sequence INTEGER NOT NULL CHECK (next_sequence >= 1),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations_order_idempotency (
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  source TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (event_id, source, idempotency_key)
);
