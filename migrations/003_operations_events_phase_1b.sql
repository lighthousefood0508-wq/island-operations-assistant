ALTER TABLE operations_events ADD COLUMN event_code TEXT;
ALTER TABLE operations_events ADD COLUMN display_name TEXT;
ALTER TABLE operations_events ADD COLUMN date TEXT;
ALTER TABLE operations_events ADD COLUMN start_time TEXT;
ALTER TABLE operations_events ADD COLUMN end_time TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS operations_events_one_open
  ON operations_events(status)
  WHERE status = 'open';

ALTER TABLE operations_product_copies ADD COLUMN display_category_name TEXT;
ALTER TABLE operations_product_copies ADD COLUMN display_category_sort_order INTEGER;

CREATE TABLE IF NOT EXISTS operations_sellable_inventory (
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  planned_quantity INTEGER NOT NULL CHECK (planned_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, product_version_id),
  CHECK (reserved_quantity + sold_quantity <= planned_quantity)
);
