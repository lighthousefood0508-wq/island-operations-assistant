-- PR-COST-006: formal unaccepted Purchase Foundation.
-- Legacy cost_purchases and cost_purchase_items remain non-authoritative.
CREATE TABLE IF NOT EXISTS cost_purchase_aggregates (
  purchase_id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES cost_suppliers(supplier_id),
  state TEXT NOT NULL CHECK (state IN ('Draft', 'Recorded')),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  recorded_at TEXT,
  recorded_by TEXT,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 0),
  CHECK ((state = 'Draft' AND recorded_at IS NULL AND recorded_by IS NULL)
      OR (state = 'Recorded' AND recorded_at IS NOT NULL AND recorded_by IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS cost_purchase_lines (
  purchase_line_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES cost_purchase_aggregates(purchase_id),
  line_position INTEGER NOT NULL CHECK (line_position >= 0),
  ingredient_id TEXT NOT NULL,
  quantity_coefficient TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 6),
  unit_code TEXT NOT NULL,
  UNIQUE (purchase_id, line_position)
);
