-- PR-COST-007: immutable formal actual-price evidence. Recorded Purchases remain unchanged.
CREATE TABLE IF NOT EXISTS cost_accepted_purchases (
  accepted_purchase_id TEXT PRIMARY KEY,
  source_purchase_id TEXT NOT NULL UNIQUE REFERENCES cost_purchase_aggregates(purchase_id),
  source_purchase_version INTEGER NOT NULL CHECK (source_purchase_version >= 0),
  supplier_id TEXT NOT NULL REFERENCES cost_suppliers(supplier_id),
  currency_code TEXT NOT NULL CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  accepted_at TEXT NOT NULL,
  accepted_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_accepted_purchase_lines (
  accepted_purchase_line_id TEXT PRIMARY KEY,
  accepted_purchase_id TEXT NOT NULL REFERENCES cost_accepted_purchases(accepted_purchase_id),
  source_purchase_line_id TEXT NOT NULL,
  line_position INTEGER NOT NULL CHECK (line_position >= 0),
  ingredient_id TEXT NOT NULL,
  raw_quantity_coefficient TEXT NOT NULL,
  raw_quantity_scale INTEGER NOT NULL CHECK (raw_quantity_scale BETWEEN 0 AND 6),
  raw_unit_code TEXT NOT NULL,
  amount_coefficient TEXT NOT NULL,
  amount_scale INTEGER NOT NULL CHECK (amount_scale BETWEEN 0 AND 6),
  normalized_quantity_coefficient TEXT NOT NULL,
  normalized_quantity_scale INTEGER NOT NULL CHECK (normalized_quantity_scale BETWEEN 0 AND 6),
  measurement_dimension TEXT NOT NULL,
  canonical_unit_code TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  profile_version_id TEXT NOT NULL,
  UNIQUE (accepted_purchase_id, source_purchase_line_id),
  UNIQUE (accepted_purchase_id, line_position)
);

CREATE INDEX IF NOT EXISTS cost_accepted_purchase_lines_ingredient_reference
  ON cost_accepted_purchase_lines(ingredient_id, accepted_purchase_id);
