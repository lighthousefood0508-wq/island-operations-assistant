CREATE TABLE IF NOT EXISTS operations_event_closeouts (
  event_id TEXT PRIMARY KEY REFERENCES operations_events(event_id),
  cash_received INTEGER NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  line_pay_received INTEGER NOT NULL DEFAULT 0 CHECK (line_pay_received >= 0),
  other_received INTEGER NOT NULL DEFAULT 0 CHECK (other_received >= 0),
  waste_amount INTEGER NOT NULL DEFAULT 0 CHECK (waste_amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  audit_log_id TEXT NOT NULL UNIQUE
);
