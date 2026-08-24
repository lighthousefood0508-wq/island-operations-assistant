-- PR-COST-009: append-only immutable Recipe Cost Snapshot evidence.
CREATE TABLE IF NOT EXISTS cost_recipe_snapshots (
  cost_snapshot_id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  recipe_version_id TEXT NOT NULL,
  valuation_policy TEXT NOT NULL,
  rounding_policy TEXT NOT NULL,
  valued_at TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  captured_by TEXT NOT NULL,
  currency_code TEXT NOT NULL CHECK (currency_code = 'TWD'),
  standard_batch_numerator TEXT NOT NULL,
  standard_batch_denominator TEXT NOT NULL,
  per_yield_numerator TEXT NOT NULL,
  per_yield_denominator TEXT NOT NULL,
  recipe_costing_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_recipe_snapshot_lines (
  cost_snapshot_id TEXT NOT NULL REFERENCES cost_recipe_snapshots(cost_snapshot_id),
  line_position INTEGER NOT NULL CHECK (line_position >= 0),
  ingredient_id TEXT NOT NULL,
  selected_source_type TEXT NOT NULL CHECK (selected_source_type IN ('ActualPurchase', 'QuoteFallback')),
  selected_source_id TEXT NOT NULL,
  exact_cost_numerator TEXT NOT NULL,
  exact_cost_denominator TEXT NOT NULL,
  recipe_line_json TEXT NOT NULL,
  selected_source_json TEXT NOT NULL,
  PRIMARY KEY (cost_snapshot_id, line_position)
);

CREATE INDEX IF NOT EXISTS cost_recipe_snapshot_lines_ingredient_reference
  ON cost_recipe_snapshot_lines(ingredient_id, cost_snapshot_id);
