CREATE TABLE IF NOT EXISTS recipe_recipes (
  recipe_id TEXT PRIMARY KEY
    CHECK (recipe_id GLOB 'recipe_*'),
  current_draft_id TEXT NOT NULL UNIQUE
    CHECK (current_draft_id GLOB 'recipe_draft_*'),
  current_recipe_version_id TEXT
    CHECK (
      current_recipe_version_id IS NULL
      OR current_recipe_version_id GLOB 'recipe_version_*'
    ),
  aggregate_version INTEGER NOT NULL
    CHECK (aggregate_version >= 1),
  state TEXT NOT NULL
    CHECK (state IN ('Draft', 'Published', 'Superseded'))
);

CREATE TABLE IF NOT EXISTS recipe_drafts (
  draft_id TEXT PRIMARY KEY
    CHECK (draft_id GLOB 'recipe_draft_*'),
  recipe_id TEXT NOT NULL
    REFERENCES recipe_recipes(recipe_id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  state TEXT NOT NULL
    CHECK (state IN ('Draft', 'Published', 'Superseded')),
  product_id TEXT,
  product_version_id TEXT,
  standard_output_coefficient TEXT,
  standard_output_scale INTEGER,
  standard_output_unit_code TEXT,
  standard_output_dimension TEXT,
  standard_yield_coefficient TEXT,
  standard_yield_scale INTEGER,
  standard_yield_unit_code TEXT,
  standard_yield_dimension TEXT,
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) > 0),
  created_at TEXT NOT NULL,
  CHECK ((product_id IS NULL) = (product_version_id IS NULL)),
  CHECK (
    (standard_output_coefficient IS NULL)
    = (standard_yield_coefficient IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS recipe_draft_lines (
  draft_id TEXT NOT NULL
    REFERENCES recipe_drafts(draft_id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  ingredient_id TEXT NOT NULL
    REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  ingredient_canonical_name TEXT NOT NULL,
  ingredient_measurement_dimension TEXT NOT NULL
    CHECK (ingredient_measurement_dimension IN ('mass', 'volume', 'count')),
  ingredient_status TEXT NOT NULL
    CHECK (ingredient_status IN ('active', 'inactive')),
  ingredient_created_at TEXT NOT NULL,
  quantity_coefficient TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 6),
  quantity_unit_code TEXT NOT NULL,
  quantity_dimension TEXT NOT NULL
    CHECK (quantity_dimension IN ('mass', 'volume', 'count')),
  PRIMARY KEY (draft_id, position),
  UNIQUE (draft_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS recipe_versions (
  recipe_version_id TEXT PRIMARY KEY
    CHECK (recipe_version_id GLOB 'recipe_version_*'),
  recipe_id TEXT NOT NULL
    REFERENCES recipe_recipes(recipe_id) ON DELETE RESTRICT,
  source_draft_id TEXT NOT NULL
    REFERENCES recipe_drafts(draft_id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  name TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  standard_output_coefficient TEXT NOT NULL,
  standard_output_scale INTEGER NOT NULL
    CHECK (standard_output_scale BETWEEN 0 AND 6),
  standard_output_unit_code TEXT NOT NULL,
  standard_output_dimension TEXT NOT NULL
    CHECK (standard_output_dimension IN ('mass', 'volume', 'count')),
  standard_yield_coefficient TEXT NOT NULL,
  standard_yield_scale INTEGER NOT NULL
    CHECK (standard_yield_scale BETWEEN 0 AND 6),
  standard_yield_unit_code TEXT NOT NULL,
  standard_yield_dimension TEXT NOT NULL
    CHECK (standard_yield_dimension IN ('mass', 'volume', 'count')),
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (recipe_id, version_number)
);

CREATE TABLE IF NOT EXISTS recipe_version_lines (
  recipe_version_id TEXT NOT NULL
    REFERENCES recipe_versions(recipe_version_id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  ingredient_id TEXT NOT NULL
    REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  ingredient_canonical_name TEXT NOT NULL,
  ingredient_measurement_dimension TEXT NOT NULL
    CHECK (ingredient_measurement_dimension IN ('mass', 'volume', 'count')),
  ingredient_status TEXT NOT NULL
    CHECK (ingredient_status IN ('active', 'inactive')),
  ingredient_created_at TEXT NOT NULL,
  quantity_coefficient TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 6),
  quantity_unit_code TEXT NOT NULL,
  quantity_dimension TEXT NOT NULL
    CHECK (quantity_dimension IN ('mass', 'volume', 'count')),
  PRIMARY KEY (recipe_version_id, position),
  UNIQUE (recipe_version_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS recipe_publish_audits (
  event_key TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL
    REFERENCES recipe_recipes(recipe_id) ON DELETE RESTRICT,
  draft_id TEXT NOT NULL
    REFERENCES recipe_drafts(draft_id) ON DELETE RESTRICT,
  recipe_version_id TEXT NOT NULL UNIQUE
    REFERENCES recipe_versions(recipe_version_id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_supersession_audits (
  event_key TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL
    REFERENCES recipe_recipes(recipe_id) ON DELETE RESTRICT,
  superseded_recipe_version_id TEXT NOT NULL UNIQUE
    REFERENCES recipe_versions(recipe_version_id) ON DELETE RESTRICT,
  superseded_by_recipe_version_id TEXT NOT NULL
    REFERENCES recipe_versions(recipe_version_id) ON DELETE RESTRICT,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  CHECK (superseded_recipe_version_id <> superseded_by_recipe_version_id)
);

CREATE INDEX IF NOT EXISTS recipe_versions_latest
  ON recipe_versions(recipe_id, version_number DESC);

CREATE INDEX IF NOT EXISTS recipe_drafts_by_recipe
  ON recipe_drafts(recipe_id, created_at DESC);
