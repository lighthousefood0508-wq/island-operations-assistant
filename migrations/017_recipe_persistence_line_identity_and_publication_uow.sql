PRAGMA defer_foreign_keys = ON;

CREATE TABLE recipe_017_recipe_map (
  recipe_id TEXT PRIMARY KEY,
  recipe_family_id TEXT NOT NULL UNIQUE,
  product_id TEXT
);

CREATE TABLE recipe_017_draft_line_map (
  draft_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  recipe_line_id TEXT NOT NULL,
  PRIMARY KEY (draft_id, position),
  UNIQUE (draft_id, recipe_line_id)
);

CREATE TABLE recipe_017_version_line_map (
  recipe_version_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  recipe_line_id TEXT NOT NULL,
  PRIMARY KEY (recipe_version_id, position),
  UNIQUE (recipe_version_id, recipe_line_id)
);

-- recipe-017-data-hook

CREATE TABLE recipe_recipes_017 (
  recipe_id TEXT PRIMARY KEY CHECK (recipe_id GLOB 'recipe_*'),
  recipe_family_id TEXT NOT NULL UNIQUE
    CHECK (recipe_family_id GLOB 'recipe_family_*'),
  product_id TEXT,
  current_draft_id TEXT NOT NULL
    CHECK (current_draft_id GLOB 'recipe_draft_*'),
  current_recipe_version_id TEXT
    CHECK (current_recipe_version_id IS NULL OR current_recipe_version_id GLOB 'recipe_version_*'),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  state TEXT NOT NULL CHECK (state IN ('Draft', 'Abandoned', 'Published', 'Superseded')),
  UNIQUE (recipe_family_id, recipe_id),
  FOREIGN KEY (recipe_family_id, current_draft_id)
    REFERENCES recipe_drafts_017(recipe_family_id, draft_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, current_recipe_version_id)
    REFERENCES recipe_versions_017(recipe_family_id, recipe_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE recipe_drafts_017 (
  draft_id TEXT PRIMARY KEY CHECK (draft_id GLOB 'recipe_draft_*'),
  recipe_id TEXT NOT NULL,
  recipe_family_id TEXT NOT NULL CHECK (recipe_family_id GLOB 'recipe_family_*'),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  state TEXT NOT NULL CHECK (state IN ('Draft', 'Abandoned', 'Published', 'Superseded')),
  product_id TEXT,
  product_version_id TEXT,
  instructions TEXT,
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
  UNIQUE (recipe_family_id, draft_id),
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes_017(recipe_family_id, recipe_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK ((product_id IS NULL) = (product_version_id IS NULL)),
  CHECK ((standard_output_coefficient IS NULL) = (standard_yield_coefficient IS NULL)),
  CHECK (standard_output_scale IS NULL OR standard_output_scale BETWEEN 0 AND 6),
  CHECK (standard_yield_scale IS NULL OR standard_yield_scale BETWEEN 0 AND 6),
  CHECK (standard_output_dimension IS NULL OR standard_output_dimension IN ('mass', 'volume', 'count')),
  CHECK (standard_yield_dimension IS NULL OR standard_yield_dimension IN ('mass', 'volume', 'count'))
);

CREATE TABLE recipe_draft_lines_017 (
  draft_id TEXT NOT NULL REFERENCES recipe_drafts_017(draft_id) ON DELETE RESTRICT,
  recipe_line_id TEXT NOT NULL CHECK (
    length(recipe_line_id) = 48
    AND substr(recipe_line_id, 1, 12) = 'recipe_line_'
    AND substr(recipe_line_id, 21, 1) = '-'
    AND substr(recipe_line_id, 26, 1) = '-'
    AND substr(recipe_line_id, 31, 1) = '-'
    AND substr(recipe_line_id, 36, 1) = '-'
    AND replace(substr(recipe_line_id, 13), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  ingredient_id TEXT NOT NULL REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  ingredient_canonical_name TEXT NOT NULL,
  ingredient_measurement_dimension TEXT NOT NULL CHECK (ingredient_measurement_dimension IN ('mass', 'volume', 'count')),
  ingredient_status TEXT NOT NULL CHECK (ingredient_status IN ('active', 'inactive')),
  ingredient_created_at TEXT NOT NULL,
  quantity_coefficient TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 6),
  quantity_unit_code TEXT NOT NULL,
  quantity_dimension TEXT NOT NULL CHECK (quantity_dimension IN ('mass', 'volume', 'count')),
  preparation_note TEXT,
  PRIMARY KEY (draft_id, recipe_line_id),
  UNIQUE (draft_id, position)
);

CREATE TABLE recipe_versions_017 (
  recipe_version_id TEXT PRIMARY KEY CHECK (recipe_version_id GLOB 'recipe_version_*'),
  recipe_id TEXT NOT NULL,
  recipe_family_id TEXT NOT NULL CHECK (recipe_family_id GLOB 'recipe_family_*'),
  source_draft_id TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  state TEXT NOT NULL CHECK (state IN ('Published', 'Superseded')),
  name TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_version_id TEXT NOT NULL,
  instructions TEXT,
  standard_output_coefficient TEXT NOT NULL,
  standard_output_scale INTEGER NOT NULL CHECK (standard_output_scale BETWEEN 0 AND 6),
  standard_output_unit_code TEXT NOT NULL,
  standard_output_dimension TEXT NOT NULL CHECK (standard_output_dimension IN ('mass', 'volume', 'count')),
  standard_yield_coefficient TEXT NOT NULL,
  standard_yield_scale INTEGER NOT NULL CHECK (standard_yield_scale BETWEEN 0 AND 6),
  standard_yield_unit_code TEXT NOT NULL,
  standard_yield_dimension TEXT NOT NULL CHECK (standard_yield_dimension IN ('mass', 'volume', 'count')),
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE (recipe_id, version_number),
  UNIQUE (recipe_family_id, recipe_version_id),
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes_017(recipe_family_id, recipe_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, source_draft_id)
    REFERENCES recipe_drafts_017(recipe_family_id, draft_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE recipe_version_lines_017 (
  recipe_version_id TEXT NOT NULL REFERENCES recipe_versions_017(recipe_version_id) ON DELETE RESTRICT,
  recipe_line_id TEXT NOT NULL CHECK (
    length(recipe_line_id) = 48
    AND substr(recipe_line_id, 1, 12) = 'recipe_line_'
    AND substr(recipe_line_id, 21, 1) = '-'
    AND substr(recipe_line_id, 26, 1) = '-'
    AND substr(recipe_line_id, 31, 1) = '-'
    AND substr(recipe_line_id, 36, 1) = '-'
    AND replace(substr(recipe_line_id, 13), '-', '') NOT GLOB '*[^0-9a-f]*'
  ),
  position INTEGER NOT NULL CHECK (position >= 0),
  ingredient_id TEXT NOT NULL REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  ingredient_canonical_name TEXT NOT NULL,
  ingredient_measurement_dimension TEXT NOT NULL CHECK (ingredient_measurement_dimension IN ('mass', 'volume', 'count')),
  ingredient_status TEXT NOT NULL CHECK (ingredient_status IN ('active', 'inactive')),
  ingredient_created_at TEXT NOT NULL,
  quantity_coefficient TEXT NOT NULL,
  quantity_scale INTEGER NOT NULL CHECK (quantity_scale BETWEEN 0 AND 6),
  quantity_unit_code TEXT NOT NULL,
  quantity_dimension TEXT NOT NULL CHECK (quantity_dimension IN ('mass', 'volume', 'count')),
  preparation_note TEXT,
  PRIMARY KEY (recipe_version_id, recipe_line_id),
  UNIQUE (recipe_version_id, position)
);

CREATE TABLE recipe_publish_audits_017 (
  event_key TEXT PRIMARY KEY,
  recipe_family_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  recipe_version_id TEXT NOT NULL UNIQUE,
  version_number INTEGER NOT NULL,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes_017(recipe_family_id, recipe_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, draft_id)
    REFERENCES recipe_drafts_017(recipe_family_id, draft_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, recipe_version_id)
    REFERENCES recipe_versions_017(recipe_family_id, recipe_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE recipe_supersession_audits_017 (
  event_key TEXT PRIMARY KEY,
  recipe_family_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  superseded_recipe_version_id TEXT NOT NULL UNIQUE,
  superseded_by_recipe_version_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  CHECK (superseded_recipe_version_id <> superseded_by_recipe_version_id),
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes_017(recipe_family_id, recipe_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, superseded_recipe_version_id)
    REFERENCES recipe_versions_017(recipe_family_id, recipe_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (recipe_family_id, superseded_by_recipe_version_id)
    REFERENCES recipe_versions_017(recipe_family_id, recipe_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO recipe_recipes_017
SELECT r.recipe_id, m.recipe_family_id, m.product_id, r.current_draft_id,
       r.current_recipe_version_id, r.aggregate_version, r.state
FROM recipe_recipes r JOIN recipe_017_recipe_map m ON m.recipe_id = r.recipe_id;

INSERT INTO recipe_drafts_017
SELECT d.draft_id, d.recipe_id, m.recipe_family_id, d.name, d.state,
       d.product_id, d.product_version_id, NULL,
       d.standard_output_coefficient, d.standard_output_scale,
       d.standard_output_unit_code, d.standard_output_dimension,
       d.standard_yield_coefficient, d.standard_yield_scale,
       d.standard_yield_unit_code, d.standard_yield_dimension,
       d.created_by, d.created_at
FROM recipe_drafts d JOIN recipe_017_recipe_map m ON m.recipe_id = d.recipe_id;

INSERT INTO recipe_draft_lines_017
SELECT l.draft_id, m.recipe_line_id, l.position, l.ingredient_id,
       l.ingredient_canonical_name, l.ingredient_measurement_dimension,
       l.ingredient_status, l.ingredient_created_at, l.quantity_coefficient,
       l.quantity_scale, l.quantity_unit_code, l.quantity_dimension, NULL
FROM recipe_draft_lines l
JOIN recipe_017_draft_line_map m ON m.draft_id = l.draft_id AND m.position = l.position;

INSERT INTO recipe_versions_017
SELECT v.recipe_version_id, v.recipe_id, m.recipe_family_id, v.source_draft_id,
       v.version_number,
       CASE WHEN s.superseded_recipe_version_id IS NULL THEN 'Published' ELSE 'Superseded' END,
       v.name, v.product_id, v.product_version_id, NULL,
       v.standard_output_coefficient, v.standard_output_scale,
       v.standard_output_unit_code, v.standard_output_dimension,
       v.standard_yield_coefficient, v.standard_yield_scale,
       v.standard_yield_unit_code, v.standard_yield_dimension,
       v.published_by, v.published_at
FROM recipe_versions v
JOIN recipe_017_recipe_map m ON m.recipe_id = v.recipe_id
LEFT JOIN recipe_supersession_audits s ON s.superseded_recipe_version_id = v.recipe_version_id;

INSERT INTO recipe_version_lines_017
SELECT l.recipe_version_id, m.recipe_line_id, l.position, l.ingredient_id,
       l.ingredient_canonical_name, l.ingredient_measurement_dimension,
       l.ingredient_status, l.ingredient_created_at, l.quantity_coefficient,
       l.quantity_scale, l.quantity_unit_code, l.quantity_dimension, NULL
FROM recipe_version_lines l
JOIN recipe_017_version_line_map m
  ON m.recipe_version_id = l.recipe_version_id AND m.position = l.position;

INSERT INTO recipe_publish_audits_017
SELECT a.event_key, m.recipe_family_id, a.recipe_id, a.draft_id,
       a.recipe_version_id, a.version_number, a.actor, a.occurred_at, NULL
FROM recipe_publish_audits a JOIN recipe_017_recipe_map m ON m.recipe_id = a.recipe_id;

INSERT INTO recipe_supersession_audits_017
SELECT a.event_key, m.recipe_family_id, a.recipe_id,
       a.superseded_recipe_version_id, a.superseded_by_recipe_version_id,
       a.actor, a.occurred_at, a.reason
FROM recipe_supersession_audits a JOIN recipe_017_recipe_map m ON m.recipe_id = a.recipe_id;

CREATE TABLE recipe_017_copy_verification (
  verified INTEGER NOT NULL CHECK (verified = 1)
);
INSERT INTO recipe_017_copy_verification
SELECT CASE WHEN
  (SELECT count(*) FROM recipe_recipes_017) = (SELECT count(*) FROM recipe_recipes)
  AND (SELECT count(*) FROM recipe_drafts_017) = (SELECT count(*) FROM recipe_drafts)
  AND (SELECT count(*) FROM recipe_draft_lines_017) = (SELECT count(*) FROM recipe_draft_lines)
  AND (SELECT count(*) FROM recipe_versions_017) = (SELECT count(*) FROM recipe_versions)
  AND (SELECT count(*) FROM recipe_version_lines_017) = (SELECT count(*) FROM recipe_version_lines)
  AND (SELECT count(*) FROM recipe_publish_audits_017) = (SELECT count(*) FROM recipe_publish_audits)
  AND (SELECT count(*) FROM recipe_supersession_audits_017) = (SELECT count(*) FROM recipe_supersession_audits)
THEN 1 ELSE 0 END;
DROP TABLE recipe_017_copy_verification;

DROP TABLE recipe_version_lines;
DROP TABLE recipe_draft_lines;
DROP TABLE recipe_supersession_audits;
DROP TABLE recipe_publish_audits;
DROP TABLE recipe_versions;
DROP TABLE recipe_drafts;
DROP TABLE recipe_recipes;

ALTER TABLE recipe_recipes_017 RENAME TO recipe_recipes;
ALTER TABLE recipe_drafts_017 RENAME TO recipe_drafts;
ALTER TABLE recipe_draft_lines_017 RENAME TO recipe_draft_lines;
ALTER TABLE recipe_versions_017 RENAME TO recipe_versions;
ALTER TABLE recipe_version_lines_017 RENAME TO recipe_version_lines;
ALTER TABLE recipe_publish_audits_017 RENAME TO recipe_publish_audits;
ALTER TABLE recipe_supersession_audits_017 RENAME TO recipe_supersession_audits;

DROP TABLE recipe_017_version_line_map;
DROP TABLE recipe_017_draft_line_map;
DROP TABLE recipe_017_recipe_map;

CREATE TABLE recipe_creation_audits (
  event_key TEXT PRIMARY KEY,
  recipe_family_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  initial_draft_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  resulting_aggregate_version INTEGER NOT NULL CHECK (resulting_aggregate_version >= 1),
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes(recipe_family_id, recipe_id) ON DELETE RESTRICT,
  FOREIGN KEY (recipe_family_id, initial_draft_id)
    REFERENCES recipe_drafts(recipe_family_id, draft_id) ON DELETE RESTRICT
);

CREATE TABLE recipe_abandonment_audits (
  event_key TEXT PRIMARY KEY,
  recipe_family_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  draft_id TEXT NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  previous_aggregate_version INTEGER NOT NULL CHECK (previous_aggregate_version >= 0),
  resulting_aggregate_version INTEGER NOT NULL,
  CHECK (resulting_aggregate_version = previous_aggregate_version + 1),
  FOREIGN KEY (recipe_family_id, recipe_id)
    REFERENCES recipe_recipes(recipe_family_id, recipe_id) ON DELETE RESTRICT,
  FOREIGN KEY (recipe_family_id, draft_id)
    REFERENCES recipe_drafts(recipe_family_id, draft_id) ON DELETE RESTRICT
);

CREATE TABLE recipe_command_receipts (
  operation_type TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(CAST(idempotency_key AS BLOB)) BETWEEN 1 AND 200),
  canonical_input_version TEXT NOT NULL CHECK (canonical_input_version = 'recipe-receipt-request-v1'),
  request_fingerprint_algorithm TEXT NOT NULL CHECK (request_fingerprint_algorithm = 'SHA-256'),
  request_fingerprint TEXT NOT NULL CHECK (
    length(request_fingerprint) = 64
    AND request_fingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  result_recipe_family_id TEXT NOT NULL,
  result_recipe_id TEXT NOT NULL,
  result_draft_id TEXT NOT NULL,
  result_recipe_version_id TEXT,
  result_version_number INTEGER,
  result_state TEXT,
  result_event_id TEXT NOT NULL,
  result_current_recipe_version_id TEXT,
  result_aggregate_version INTEGER NOT NULL CHECK (result_aggregate_version >= 1),
  created_at TEXT NOT NULL,
  PRIMARY KEY (operation_type, scope_type, scope_id, idempotency_key),
  FOREIGN KEY (result_recipe_family_id, result_recipe_id)
    REFERENCES recipe_recipes(recipe_family_id, recipe_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (result_recipe_family_id, result_draft_id)
    REFERENCES recipe_drafts(recipe_family_id, draft_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (result_recipe_family_id, result_recipe_version_id)
    REFERENCES recipe_versions(recipe_family_id, recipe_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (operation_type = 'FAMILY_CREATE' AND scope_type = 'PRODUCT'
      AND result_recipe_version_id IS NULL AND result_version_number IS NULL
      AND result_state IS NULL AND result_current_recipe_version_id IS NULL)
    OR
    (operation_type = 'DRAFT_ABANDON' AND scope_type = 'RECIPE_DRAFT'
      AND result_recipe_version_id IS NULL AND result_version_number IS NULL
      AND result_state = 'Abandoned' AND scope_id = result_draft_id)
    OR
    (operation_type = 'RECIPE_PUBLISH' AND scope_type = 'RECIPE_FAMILY'
      AND result_recipe_version_id IS NOT NULL AND result_version_number IS NOT NULL
      AND result_state IS NULL
      AND result_current_recipe_version_id = result_recipe_version_id
      AND scope_id = result_recipe_family_id)
  )
);

CREATE UNIQUE INDEX recipe_recipes_one_bound_product
  ON recipe_recipes(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX recipe_versions_latest ON recipe_versions(recipe_id, version_number DESC);
CREATE INDEX recipe_drafts_by_recipe ON recipe_drafts(recipe_id, created_at DESC);

CREATE TRIGGER recipe_recipes_product_binding_immutable
BEFORE UPDATE OF product_id ON recipe_recipes
WHEN OLD.product_id IS NOT NULL AND (NEW.product_id IS NULL OR NEW.product_id <> OLD.product_id)
BEGIN
  SELECT RAISE(ABORT, 'Recipe Product binding is immutable');
END;

CREATE TRIGGER recipe_versions_immutable
BEFORE UPDATE ON recipe_versions
WHEN NEW.recipe_version_id <> OLD.recipe_version_id
  OR NEW.recipe_id <> OLD.recipe_id
  OR NEW.recipe_family_id <> OLD.recipe_family_id
  OR NEW.source_draft_id <> OLD.source_draft_id
  OR NEW.version_number <> OLD.version_number
  OR NEW.name <> OLD.name
  OR NEW.product_id <> OLD.product_id
  OR NEW.product_version_id <> OLD.product_version_id
  OR NEW.instructions IS NOT OLD.instructions
  OR NEW.standard_output_coefficient <> OLD.standard_output_coefficient
  OR NEW.standard_output_scale <> OLD.standard_output_scale
  OR NEW.standard_output_unit_code <> OLD.standard_output_unit_code
  OR NEW.standard_output_dimension <> OLD.standard_output_dimension
  OR NEW.standard_yield_coefficient <> OLD.standard_yield_coefficient
  OR NEW.standard_yield_scale <> OLD.standard_yield_scale
  OR NEW.standard_yield_unit_code <> OLD.standard_yield_unit_code
  OR NEW.standard_yield_dimension <> OLD.standard_yield_dimension
  OR NEW.published_by <> OLD.published_by
  OR NEW.published_at <> OLD.published_at
  OR NOT (OLD.state = 'Published' AND NEW.state = 'Superseded')
BEGIN
  SELECT RAISE(ABORT, 'Published Recipe Version is immutable');
END;

CREATE TRIGGER recipe_version_lines_no_update
BEFORE UPDATE ON recipe_version_lines BEGIN SELECT RAISE(ABORT, 'Published Recipe Lines are immutable'); END;
CREATE TRIGGER recipe_version_lines_no_delete
BEFORE DELETE ON recipe_version_lines BEGIN SELECT RAISE(ABORT, 'Published Recipe Lines are immutable'); END;
CREATE TRIGGER recipe_drafts_abandoned_terminal
BEFORE UPDATE ON recipe_drafts
WHEN OLD.state = 'Abandoned'
BEGIN SELECT RAISE(ABORT, 'Abandoned Recipe Draft is terminal'); END;
CREATE TRIGGER recipe_publish_audits_no_update BEFORE UPDATE ON recipe_publish_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_publish_audits_no_delete BEFORE DELETE ON recipe_publish_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_supersession_audits_no_update BEFORE UPDATE ON recipe_supersession_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_supersession_audits_no_delete BEFORE DELETE ON recipe_supersession_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_creation_audits_no_update BEFORE UPDATE ON recipe_creation_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_creation_audits_no_delete BEFORE DELETE ON recipe_creation_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_abandonment_audits_no_update BEFORE UPDATE ON recipe_abandonment_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_abandonment_audits_no_delete BEFORE DELETE ON recipe_abandonment_audits BEGIN SELECT RAISE(ABORT, 'Recipe audit is append-only'); END;
CREATE TRIGGER recipe_receipts_no_update BEFORE UPDATE ON recipe_command_receipts BEGIN SELECT RAISE(ABORT, 'Recipe receipt is immutable'); END;
CREATE TRIGGER recipe_receipts_no_delete BEFORE DELETE ON recipe_command_receipts BEGIN SELECT RAISE(ABORT, 'Recipe receipt is immutable'); END;
