-- Cost Persistence (DECISIONS #050).
-- Ingredient Cost Quotes preserve exact purchase evidence and append-first
-- supersession history. They are not normalized unit costs or Recipe costs.

CREATE TABLE IF NOT EXISTS cost_ingredient_cost_quotes (
  quote_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  amount_coefficient INTEGER NOT NULL
    CHECK (typeof(amount_coefficient) = 'integer' AND amount_coefficient >= 0),
  amount_scale INTEGER NOT NULL
    CHECK (typeof(amount_scale) = 'integer' AND amount_scale BETWEEN 0 AND 6),
  currency_code TEXT NOT NULL
    CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  purchase_quantity_coefficient INTEGER NOT NULL
    CHECK (typeof(purchase_quantity_coefficient) = 'integer' AND purchase_quantity_coefficient > 0),
  purchase_quantity_scale INTEGER NOT NULL
    CHECK (typeof(purchase_quantity_scale) = 'integer' AND purchase_quantity_scale BETWEEN 0 AND 6),
  unit_code TEXT NOT NULL
    CHECK (length(trim(unit_code)) > 0 AND unit_code = lower(unit_code)),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('supplier', 'manual', 'invoice', 'receipt', 'contract', 'system')),
  source_reference_id TEXT
    CHECK (source_reference_id IS NULL OR length(trim(source_reference_id)) > 0),
  supplier_id TEXT
    CHECK (supplier_id IS NULL OR length(trim(supplier_id)) > 0),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL CHECK (length(trim(recorded_by)) > 0),
  superseded_at TEXT,
  superseded_by_quote_id TEXT REFERENCES cost_ingredient_cost_quotes(quote_id),
  superseded_by_actor TEXT,
  aggregate_version INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(aggregate_version) = 'integer' AND aggregate_version >= 0),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (
    (superseded_at IS NULL AND superseded_by_quote_id IS NULL AND superseded_by_actor IS NULL AND aggregate_version = 0)
    OR
    (superseded_at IS NOT NULL AND superseded_by_quote_id IS NOT NULL
      AND length(trim(superseded_by_actor)) > 0 AND aggregate_version > 0)
  ),
  CHECK (superseded_by_quote_id IS NULL OR superseded_by_quote_id <> quote_id)
);

CREATE INDEX IF NOT EXISTS cost_ingredient_cost_quotes_ingredient_effective_period
  ON cost_ingredient_cost_quotes(ingredient_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS cost_ingredient_cost_quotes_superseded_at
  ON cost_ingredient_cost_quotes(superseded_at);

CREATE INDEX IF NOT EXISTS cost_ingredient_cost_quotes_superseding_quote
  ON cost_ingredient_cost_quotes(superseded_by_quote_id);
