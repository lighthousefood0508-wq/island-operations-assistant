-- Cost Supplier Foundation (DECISIONS #079).
-- Supplier identity is Cost-owned and intentionally contains no Purchase,
-- Accepted Purchase, package, pricing, or measurement authority.

CREATE TABLE IF NOT EXISTS cost_suppliers (
  supplier_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) > 0),
  aggregate_version INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(aggregate_version) = 'integer' AND aggregate_version = 0)
);
