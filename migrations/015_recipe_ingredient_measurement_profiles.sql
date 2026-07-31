CREATE TABLE IF NOT EXISTS recipe_ingredient_measurement_profiles (
  profile_id TEXT PRIMARY KEY
    CHECK (profile_id GLOB 'measurement_profile_*'),
  ingredient_id TEXT NOT NULL UNIQUE
    REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  aggregate_version INTEGER NOT NULL
    CHECK (aggregate_version >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
    CHECK (length(trim(created_by)) > 0)
);

CREATE TABLE IF NOT EXISTS recipe_ingredient_measurement_profile_versions (
  profile_version_id TEXT PRIMARY KEY
    CHECK (profile_version_id GLOB 'measurement_profile_version_*'),
  profile_id TEXT NOT NULL
    REFERENCES recipe_ingredient_measurement_profiles(profile_id) ON DELETE RESTRICT,
  ingredient_id TEXT NOT NULL
    REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  version_position INTEGER NOT NULL
    CHECK (version_position >= 0),
  state TEXT NOT NULL
    CHECK (state IN ('Draft', 'Active', 'Deprecated', 'Superseded')),
  dimension TEXT
    CHECK (dimension IS NULL OR dimension IN ('mass', 'volume', 'count')),
  canonical_unit_code TEXT
    CHECK (canonical_unit_code IS NULL OR canonical_unit_code IN ('g', 'ml', 'each')),
  allowed_unit_codes_json TEXT,
  profile_aliases_json TEXT,
  source_type TEXT
    CHECK (source_type IS NULL OR source_type IN ('SYSTEM', 'MANUAL', 'SUPPLIER', 'LEGACY')),
  source_reference_id TEXT,
  source_recorded_at TEXT,
  source_recorded_by TEXT,
  effective_from TEXT,
  effective_to TEXT,
  superseding_profile_version_id TEXT,
  lifecycle_json TEXT NOT NULL,
  UNIQUE (profile_id, version_position),
  UNIQUE (profile_id, profile_version_id),
  CHECK (
    (state = 'Draft' AND effective_from IS NULL AND effective_to IS NULL)
    OR
    (state = 'Active' AND effective_from IS NOT NULL AND effective_to IS NULL)
    OR
    (state IN ('Deprecated', 'Superseded') AND effective_from IS NOT NULL AND effective_to IS NOT NULL)
  ),
  CHECK (
    state = 'Draft'
    OR (
      dimension IS NOT NULL
      AND canonical_unit_code IS NOT NULL
      AND allowed_unit_codes_json IS NOT NULL
      AND profile_aliases_json IS NOT NULL
      AND source_type IS NOT NULL
      AND source_recorded_at IS NOT NULL
      AND source_recorded_by IS NOT NULL
    )
  ),
  CHECK (
    (state = 'Superseded' AND superseding_profile_version_id IS NOT NULL)
    OR
    (state <> 'Superseded' AND superseding_profile_version_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_measurement_profiles_one_active
  ON recipe_ingredient_measurement_profile_versions(ingredient_id)
  WHERE state = 'Active';

CREATE INDEX IF NOT EXISTS recipe_measurement_profiles_effective_lookup
  ON recipe_ingredient_measurement_profile_versions(
    ingredient_id,
    effective_from,
    effective_to,
    state
  );
