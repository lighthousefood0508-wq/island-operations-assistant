CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  business_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE (business_id, login)
);

CREATE TABLE IF NOT EXISTS roles (
  role_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role_id TEXT NOT NULL REFERENCES roles(role_id),
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  PRIMARY KEY (user_id, role_id, business_id)
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  label TEXT NOT NULL,
  device_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  category_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  category_id TEXT REFERENCES categories(category_id),
  sku TEXT,
  internal_name TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  UNIQUE (business_id, sku)
);

CREATE TABLE IF NOT EXISTS product_versions (
  product_version_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  version_number INTEGER NOT NULL,
  official_name TEXT NOT NULL,
  pos_short_name TEXT,
  customer_display_name TEXT,
  list_price INTEGER NOT NULL,
  effective_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (product_id, version_number)
);

CREATE TABLE IF NOT EXISTS product_channels (
  product_channel_id TEXT PRIMARY KEY,
  product_version_id TEXT NOT NULL REFERENCES product_versions(product_version_id),
  event_id TEXT,
  channel TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 0,
  price_override INTEGER,
  allocation_limit INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  name TEXT NOT NULL,
  location TEXT,
  starts_at TEXT NOT NULL,
  preorder_close_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability_allocations (
  allocation_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(event_id),
  product_id TEXT NOT NULL REFERENCES products(product_id),
  channel TEXT NOT NULL,
  sellable_qty INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  sold_qty INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (event_id, product_id, channel)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  event_id TEXT REFERENCES events(event_id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  service_fee INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  paid_total INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  product_id TEXT NOT NULL REFERENCES products(product_id),
  product_version_id TEXT NOT NULL REFERENCES product_versions(product_version_id),
  product_name_snapshot TEXT NOT NULL,
  category_snapshot TEXT,
  quantity INTEGER NOT NULL,
  unit_list_price INTEGER NOT NULL,
  unit_selling_price INTEGER NOT NULL,
  line_discount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  unit_cost_snapshot INTEGER,
  bom_version_snapshot TEXT,
  cost_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS order_status_events (
  order_status_event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(user_id),
  occurred_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id),
  method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  external_reference TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
  ingredient_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  canonical_name TEXT NOT NULL,
  base_unit TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boms (
  bom_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  UNIQUE (product_id, version_number)
);

CREATE TABLE IF NOT EXISTS bom_items (
  bom_item_id TEXT PRIMARY KEY,
  bom_id TEXT NOT NULL REFERENCES boms(bom_id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(ingredient_id),
  quantity REAL NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_batches (
  batch_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  product_id TEXT REFERENCES products(product_id),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  inventory_transaction_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  ingredient_id TEXT REFERENCES ingredients(ingredient_id),
  batch_id TEXT REFERENCES production_batches(batch_id),
  transaction_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost INTEGER,
  occurred_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  purchase_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  receipt_number TEXT,
  purchase_date TEXT NOT NULL,
  total_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  purchase_item_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(purchase_id),
  ingredient_id TEXT REFERENCES ingredients(ingredient_id),
  raw_name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  amount INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS waste (
  waste_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  event_id TEXT REFERENCES events(event_id),
  product_id TEXT REFERENCES products(product_id),
  ingredient_id TEXT REFERENCES ingredients(ingredient_id),
  quantity REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  sync_job_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS external_events (
  external_event_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (business_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(business_id),
  actor_user_id TEXT REFERENCES users(user_id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  occurred_at TEXT NOT NULL
);
