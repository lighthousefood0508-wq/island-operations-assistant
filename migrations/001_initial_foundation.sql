PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  role_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role_id TEXT NOT NULL REFERENCES roles(role_id),
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(user_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_categories (
  category_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_products (
  product_id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES catalog_categories(category_id),
  internal_name TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_product_versions (
  product_version_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES catalog_products(product_id),
  version_number INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  pos_name TEXT NOT NULL,
  selling_price INTEGER NOT NULL CHECK (selling_price >= 0),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (product_id, version_number)
);

CREATE TABLE IF NOT EXISTS catalog_product_channels (
  product_channel_id TEXT PRIMARY KEY,
  product_version_id TEXT NOT NULL REFERENCES catalog_product_versions(product_version_id),
  channel TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (product_version_id, channel)
);

CREATE TABLE IF NOT EXISTS operations_events (
  event_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  location TEXT,
  starts_at TEXT NOT NULL,
  preorder_closes_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations_product_copies (
  operations_product_copy_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  category_id TEXT,
  display_name TEXT NOT NULL,
  pos_name TEXT NOT NULL,
  selling_price INTEGER NOT NULL CHECK (selling_price >= 0),
  channels_json TEXT NOT NULL,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
  published_at TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE (product_version_id)
);

CREATE TABLE IF NOT EXISTS operations_availability (
  availability_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES operations_events(event_id),
  operations_product_copy_id TEXT NOT NULL REFERENCES operations_product_copies(operations_product_copy_id),
  channel TEXT NOT NULL,
  sellable_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sellable_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, operations_product_copy_id, channel)
);

CREATE TABLE IF NOT EXISTS operations_orders (
  order_id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES operations_events(event_id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_total INTEGER NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  grand_total INTEGER NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  paid_total INTEGER NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS operations_order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  operations_product_copy_id TEXT REFERENCES operations_product_copies(operations_product_copy_id),
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS operations_payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  external_reference TEXT,
  paid_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operations_order_status_events (
  order_status_event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES operations_orders(order_id),
  status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(user_id),
  occurred_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS operations_sales_outbox (
  sales_event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES operations_orders(order_id),
  contract_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  exported_at TEXT
);

CREATE TABLE IF NOT EXISTS cost_ingredients (
  ingredient_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  base_unit TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_ingredient_aliases (
  ingredient_alias_id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES cost_ingredients(ingredient_id),
  alias_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (alias_name)
);

CREATE TABLE IF NOT EXISTS cost_unit_conversions (
  unit_conversion_id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES cost_ingredients(ingredient_id),
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  multiplier REAL NOT NULL CHECK (multiplier > 0),
  created_at TEXT NOT NULL,
  UNIQUE (ingredient_id, from_unit, to_unit)
);

CREATE TABLE IF NOT EXISTS cost_boms (
  bom_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (product_version_id, version_number)
);

CREATE TABLE IF NOT EXISTS cost_bom_items (
  bom_item_id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL REFERENCES cost_boms(bom_id),
  ingredient_id TEXT NOT NULL REFERENCES cost_ingredients(ingredient_id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_sales_imports (
  cost_sales_import_id TEXT PRIMARY KEY,
  sales_event_id TEXT NOT NULL UNIQUE,
  contract_version TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  source_completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_inventory_transactions (
  inventory_transaction_id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES cost_ingredients(ingredient_id),
  transaction_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost INTEGER,
  source_type TEXT,
  source_id TEXT,
  occurred_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS cost_purchases (
  purchase_id TEXT PRIMARY KEY,
  receipt_number TEXT,
  vendor_name TEXT,
  purchase_date TEXT NOT NULL,
  total_amount INTEGER CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_purchase_items (
  purchase_item_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES cost_purchases(purchase_id),
  ingredient_id TEXT REFERENCES cost_ingredients(ingredient_id),
  raw_name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  amount INTEGER CHECK (amount >= 0),
  review_status TEXT NOT NULL DEFAULT 'pending'
);
