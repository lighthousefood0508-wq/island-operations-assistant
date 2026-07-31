-- Canonical Ingredient Persistence (DECISIONS #059).
-- Canonical Ingredient Identity Authority is hosted in Recipe Core, but is not
-- Recipe-owned. Legacy cost_ingredients data is not promoted or copied here.

CREATE TABLE IF NOT EXISTS recipe_canonical_ingredients (
  ingredient_id TEXT PRIMARY KEY
    CHECK (
      length(ingredient_id) = 40
      AND substr(ingredient_id, 1, 4) = 'ing_'
    ),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  category_code TEXT NOT NULL
    CHECK (
      length(trim(category_code)) > 0
      AND category_code = lower(category_code)
    ),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Archived')),
  aggregate_version INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(aggregate_version) = 'integer' AND aggregate_version >= 0),
  created_at TEXT NOT NULL CHECK (length(trim(created_at)) > 0),
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) > 0),
  archived_at TEXT,
  archived_by TEXT,
  archive_reason TEXT,
  CHECK (
    (
      status = 'Active'
      AND archived_at IS NULL
      AND archived_by IS NULL
      AND archive_reason IS NULL
    )
    OR
    (
      status = 'Archived'
      AND archived_at IS NOT NULL
      AND length(trim(archived_by)) > 0
      AND length(trim(archive_reason)) > 0
      AND aggregate_version > 0
      AND archived_at >= created_at
    )
  )
);

CREATE TABLE IF NOT EXISTS recipe_canonical_ingredient_renames (
  ingredient_id TEXT NOT NULL
    REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  transition_version INTEGER NOT NULL
    CHECK (typeof(transition_version) = 'integer' AND transition_version > 0),
  previous_name TEXT NOT NULL CHECK (length(trim(previous_name)) > 0),
  new_name TEXT NOT NULL CHECK (length(trim(new_name)) > 0),
  renamed_at TEXT NOT NULL CHECK (length(trim(renamed_at)) > 0),
  renamed_by TEXT NOT NULL CHECK (length(trim(renamed_by)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  PRIMARY KEY (ingredient_id, transition_version),
  CHECK (previous_name <> new_name)
);

CREATE INDEX IF NOT EXISTS recipe_canonical_ingredients_active_name
  ON recipe_canonical_ingredients(status, name);
