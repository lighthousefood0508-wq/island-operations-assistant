ALTER TABLE catalog_categories ADD COLUMN code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_code_unique
  ON catalog_categories(code)
  WHERE code IS NOT NULL;

ALTER TABLE catalog_products ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
UPDATE catalog_products
SET status = CASE lifecycle_status
  WHEN 'published' THEN 'published'
  WHEN 'inactive' THEN 'inactive'
  ELSE 'draft'
END;

ALTER TABLE catalog_product_versions ADD COLUMN description TEXT;

CREATE TABLE IF NOT EXISTS catalog_product_drafts (
  product_id TEXT PRIMARY KEY REFERENCES catalog_products(product_id),
  display_name TEXT,
  pos_name TEXT,
  selling_price INTEGER CHECK (selling_price >= 0),
  description TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_product_draft_channels (
  product_id TEXT NOT NULL REFERENCES catalog_products(product_id),
  channel TEXT NOT NULL CHECK (channel IN ('pos', 'kiosk', 'preorder')),
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (product_id, channel)
);

CREATE TRIGGER IF NOT EXISTS catalog_product_versions_are_immutable
BEFORE UPDATE ON catalog_product_versions
WHEN OLD.published_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published product versions are immutable');
END;
