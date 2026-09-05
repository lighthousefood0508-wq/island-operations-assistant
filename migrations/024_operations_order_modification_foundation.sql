CREATE TABLE IF NOT EXISTS operations_order_modification_intents (
  intent_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  root_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  effective_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  expected_effective_revision TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('prepared', 'external_in_progress', 'confirmed', 'cancelled', 'expired', 'reconciliation_required')),
  intent_revision INTEGER NOT NULL DEFAULT 1 CHECK (intent_revision > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  difference_json TEXT NOT NULL,
  original_collected INTEGER NOT NULL CHECK (original_collected >= 0),
  new_total INTEGER NOT NULL CHECK (new_total >= 0),
  adjustment_amount INTEGER NOT NULL CHECK (adjustment_amount >= 0),
  adjustment_direction TEXT NOT NULL CHECK (adjustment_direction IN ('none', 'supplement', 'refund')),
  adjustment_method TEXT CHECK (adjustment_method IN ('CASH', 'LINE_PAY')),
  payment_basis_status TEXT NOT NULL CHECK (payment_basis_status IN ('unpaid', 'paid')),
  outcome_kind TEXT NOT NULL CHECK (outcome_kind IN ('replacement', 'cancellation')),
  production_reset_required INTEGER NOT NULL CHECK (production_reset_required IN (0, 1)),
  created_by TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_renewed_at TEXT,
  external_started_at TEXT,
  confirmed_at TEXT,
  cancelled_at TEXT,
  expired_at TEXT,
  reconciliation_required_at TEXT,
  transitioned_by TEXT,
  transition_reason TEXT,
  CHECK (
    (adjustment_direction = 'none' AND adjustment_amount = 0 AND adjustment_method IS NULL)
    OR
    (adjustment_direction IN ('supplement', 'refund') AND adjustment_amount > 0 AND adjustment_method IS NOT NULL)
  ),
  CHECK (payment_basis_status = 'paid' OR (adjustment_direction = 'none' AND adjustment_amount = 0)),
  CHECK (outcome_kind = 'replacement' OR new_total = 0),
  CHECK (state != 'prepared' OR expires_at IS NOT NULL),
  CHECK (state != 'external_in_progress' OR external_started_at IS NOT NULL),
  CHECK (state != 'confirmed' OR confirmed_at IS NOT NULL),
  CHECK (state != 'cancelled' OR cancelled_at IS NOT NULL),
  CHECK (state != 'expired' OR expired_at IS NOT NULL),
  CHECK (state != 'reconciliation_required' OR reconciliation_required_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_order_modification_intents_active_root_unique
  ON operations_order_modification_intents(root_order_id)
  WHERE state IN ('prepared', 'external_in_progress', 'reconciliation_required');

CREATE INDEX IF NOT EXISTS operations_order_modification_intents_event_state
  ON operations_order_modification_intents(event_id, state);

CREATE INDEX IF NOT EXISTS operations_order_modification_intents_root_created
  ON operations_order_modification_intents(root_order_id, created_at);

CREATE TABLE IF NOT EXISTS operations_order_modification_intent_items (
  intent_item_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES operations_order_modification_intents(intent_id) ON DELETE RESTRICT,
  line_sequence INTEGER NOT NULL CHECK (line_sequence >= 0),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  pos_name_snapshot TEXT NOT NULL,
  display_category_name_snapshot TEXT,
  unit_list_price INTEGER NOT NULL CHECK (unit_list_price >= 0),
  unit_selling_price INTEGER NOT NULL CHECK (unit_selling_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_discount INTEGER NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  notes TEXT,
  cost_status TEXT NOT NULL DEFAULT 'unavailable' CHECK (cost_status = 'unavailable'),
  UNIQUE (intent_id, line_sequence),
  UNIQUE (intent_id, product_id)
);

CREATE TABLE IF NOT EXISTS operations_order_modification_reservations (
  reservation_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES operations_order_modification_intents(intent_id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  reserved_quantity INTEGER NOT NULL CHECK (reserved_quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('held', 'committed', 'released')),
  created_at TEXT NOT NULL,
  terminal_at TEXT,
  terminal_by TEXT,
  CHECK (status = 'held' OR (terminal_at IS NOT NULL AND terminal_by IS NOT NULL)),
  UNIQUE (intent_id, product_version_id)
);

CREATE INDEX IF NOT EXISTS operations_order_modification_reservations_intent_status
  ON operations_order_modification_reservations(intent_id, status);

CREATE INDEX IF NOT EXISTS operations_order_modification_reservations_inventory
  ON operations_order_modification_reservations(event_id, product_version_id, status);

CREATE TABLE IF NOT EXISTS operations_order_replacements (
  replacement_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL UNIQUE REFERENCES operations_order_modification_intents(intent_id),
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  root_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  superseded_order_id TEXT NOT NULL UNIQUE REFERENCES operations_orders(order_id),
  replacement_order_id TEXT NOT NULL UNIQUE REFERENCES operations_orders(order_id),
  effective_revision INTEGER NOT NULL CHECK (effective_revision > 1),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (superseded_order_id <> replacement_order_id),
  UNIQUE (root_order_id, effective_revision)
);

CREATE INDEX IF NOT EXISTS operations_order_replacements_root_revision
  ON operations_order_replacements(root_order_id, effective_revision DESC);

CREATE TABLE IF NOT EXISTS operations_payment_adjustments (
  payment_adjustment_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL UNIQUE REFERENCES operations_order_modification_intents(intent_id),
  root_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  effective_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  replacement_order_id TEXT REFERENCES operations_orders(order_id),
  direction TEXT NOT NULL CHECK (direction IN ('supplement', 'refund')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'LINE_PAY')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  external_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  confirmed_by TEXT NOT NULL,
  device_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  CHECK (payment_method != 'LINE_PAY' OR external_reference IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_payment_adjustments_external_reference_unique
  ON operations_payment_adjustments(external_reference)
  WHERE payment_method = 'LINE_PAY' AND external_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_order_item_dispositions (
  disposition_id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES operations_order_modification_intents(intent_id),
  replacement_id TEXT REFERENCES operations_order_replacements(replacement_id),
  source_order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  source_order_item_id TEXT NOT NULL REFERENCES operations_order_items(order_item_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  pos_name_snapshot TEXT NOT NULL,
  unit_selling_price INTEGER NOT NULL CHECK (unit_selling_price >= 0),
  removed_quantity INTEGER NOT NULL CHECK (removed_quantity > 0),
  returned_to_sellable_quantity INTEGER NOT NULL CHECK (returned_to_sellable_quantity >= 0),
  not_returned_quantity INTEGER NOT NULL CHECK (not_returned_quantity >= 0),
  reason TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  device_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  CHECK (returned_to_sellable_quantity + not_returned_quantity = removed_quantity),
  UNIQUE (intent_id, source_order_item_id)
);

CREATE INDEX IF NOT EXISTS operations_order_item_dispositions_source
  ON operations_order_item_dispositions(source_order_id, product_version_id);

CREATE INDEX IF NOT EXISTS operations_order_item_dispositions_replacement
  ON operations_order_item_dispositions(replacement_id);
