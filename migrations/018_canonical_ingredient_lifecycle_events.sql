PRAGMA defer_foreign_keys = ON;

CREATE TABLE recipe_canonical_ingredient_lifecycle_events (
  ingredient_id TEXT NOT NULL REFERENCES recipe_canonical_ingredients(ingredient_id) ON DELETE RESTRICT,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('RENAMED', 'ARCHIVED', 'REACTIVATED')),
  occurred_at TEXT NOT NULL CHECK (length(trim(occurred_at)) > 0),
  actor TEXT NOT NULL CHECK (length(trim(actor)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  previous_name TEXT,
  new_name TEXT,
  PRIMARY KEY (ingredient_id, aggregate_version),
  CHECK (
    (event_type = 'RENAMED' AND previous_name IS NOT NULL AND new_name IS NOT NULL AND previous_name <> new_name)
    OR
    (event_type IN ('ARCHIVED', 'REACTIVATED') AND previous_name IS NULL AND new_name IS NULL)
  )
);

INSERT INTO recipe_canonical_ingredient_lifecycle_events (
  ingredient_id, aggregate_version, event_type, occurred_at, actor, reason, previous_name, new_name
)
SELECT ingredient_id, transition_version, 'RENAMED', renamed_at, renamed_by, reason, previous_name, new_name
FROM recipe_canonical_ingredient_renames;

INSERT INTO recipe_canonical_ingredient_lifecycle_events (
  ingredient_id, aggregate_version, event_type, occurred_at, actor, reason, previous_name, new_name
)
SELECT ingredient_id, aggregate_version, 'ARCHIVED', archived_at, archived_by, archive_reason, NULL, NULL
FROM recipe_canonical_ingredients
WHERE status = 'Archived';

CREATE TABLE recipe_018_canonical_ingredient_verification (
  verified INTEGER NOT NULL CHECK (verified = 1)
);
INSERT INTO recipe_018_canonical_ingredient_verification
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM recipe_canonical_ingredients ingredient
  WHERE ingredient.aggregate_version <> (
    SELECT count(*) FROM recipe_canonical_ingredient_lifecycle_events event
    WHERE event.ingredient_id = ingredient.ingredient_id
  )
) THEN 1 ELSE 0 END;
DROP TABLE recipe_018_canonical_ingredient_verification;

DROP TABLE recipe_canonical_ingredient_renames;

CREATE INDEX recipe_canonical_ingredient_lifecycle_events_by_ingredient
  ON recipe_canonical_ingredient_lifecycle_events(ingredient_id, aggregate_version);

CREATE TRIGGER recipe_canonical_ingredient_lifecycle_events_no_update
BEFORE UPDATE ON recipe_canonical_ingredient_lifecycle_events
BEGIN SELECT RAISE(ABORT, 'Canonical Ingredient lifecycle evidence is immutable'); END;
CREATE TRIGGER recipe_canonical_ingredient_lifecycle_events_no_delete
BEFORE DELETE ON recipe_canonical_ingredient_lifecycle_events
BEGIN SELECT RAISE(ABORT, 'Canonical Ingredient lifecycle evidence is immutable'); END;
