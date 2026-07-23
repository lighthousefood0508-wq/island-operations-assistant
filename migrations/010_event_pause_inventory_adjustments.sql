-- Event Lifecycle Implementation Slice 1 (DECISIONS #047).
-- Operations owns these operational records. They do not represent Cost/BOM waste.

ALTER TABLE operations_sellable_inventory
  ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1));

DROP INDEX IF EXISTS operations_events_one_open;
CREATE UNIQUE INDEX IF NOT EXISTS operations_events_one_operational
  ON operations_events(status)
  WHERE status IN ('open', 'paused');

CREATE TABLE IF NOT EXISTS operations_inventory_adjustment_batches (
  batch_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at TEXT NOT NULL,
  audit_log_id TEXT NOT NULL UNIQUE,
  UNIQUE (event_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS operations_inventory_adjustments (
  adjustment_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES operations_inventory_adjustment_batches(batch_id),
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  planned_before INTEGER NOT NULL,
  planned_after INTEGER NOT NULL,
  safety_before INTEGER NOT NULL,
  safety_after INTEGER NOT NULL,
  enabled_before INTEGER NOT NULL CHECK (enabled_before IN (0, 1)),
  enabled_after INTEGER NOT NULL CHECK (enabled_after IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations_event_closeout_items (
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  waste_quantity INTEGER NOT NULL CHECK (waste_quantity >= 0),
  retained_quantity INTEGER NOT NULL CHECK (retained_quantity >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, product_version_id),
  CHECK (waste_quantity + retained_quantity = remaining_quantity)
);
