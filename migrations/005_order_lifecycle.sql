CREATE TABLE IF NOT EXISTS operations_inventory_releases (
  order_id TEXT PRIMARY KEY REFERENCES operations_orders(order_id),
  released_at TEXT NOT NULL,
  operator TEXT NOT NULL,
  audit_log_id TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS operations_event_closures (
  event_id TEXT PRIMARY KEY REFERENCES operations_events(event_id),
  closed_at TEXT NOT NULL,
  operator TEXT NOT NULL,
  daily_report_json TEXT NOT NULL,
  audit_log_id TEXT NOT NULL UNIQUE
);
