import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { BetterSqlite3Adapter } from "../dist/shared/database/better-sqlite3-adapter.js";
import { runMigrations } from "../dist/shared/database/migrate.js";

const migrationDirectory = path.resolve("migrations");
const migrationFiles = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const through014 = migrationFiles.filter((name) => name <= "014_recipe_canonical_ingredients.sql");
const expectedUpgrade = migrationFiles.filter((name) => !through014.includes(name));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function openDatabase(databasePath) {
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  return database;
}

function applyHistoricalMigrations(database) {
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const apply = database.transaction((filename) => {
    database.exec(readFileSync(path.join(migrationDirectory, filename), "utf8"));
    database.prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)")
      .run(filename, "2026-07-31T00:00:00.000Z");
  });
  for (const filename of through014) apply(filename);
}

function seedPopulated014Fixture(database) {
  database.exec(`
    INSERT INTO users (user_id, login, display_name, status, created_at)
    VALUES ('user_owner', 'owner', 'Owner', 'active', '2026-07-31T08:00:00.000Z');
    INSERT INTO roles (role_id, code, name, created_at)
    VALUES ('role_admin', 'admin', 'Administrator', '2026-07-31T08:00:00.000Z');
    INSERT INTO user_roles (user_id, role_id, assigned_at)
    VALUES ('user_owner', 'role_admin', '2026-07-31T08:01:00.000Z');
    INSERT INTO audit_logs (audit_log_id, actor_user_id, entity_type, entity_id, action, before_json, after_json, occurred_at)
    VALUES ('audit_fixture', 'user_owner', 'fixture', 'fixture_014', 'created', NULL, '{"version":14}', '2026-07-31T08:02:00.000Z');
    INSERT INTO system_settings (setting_key, setting_value, updated_at)
    VALUES ('fixture.release_gate', '001-014', '2026-07-31T08:03:00.000Z');

    INSERT INTO catalog_categories (category_id, display_name, sort_order, is_active, created_at, updated_at, code)
    VALUES ('cat_fixture', 'Fixture Meals', 1, 1, '2026-07-31T08:00:00.000Z', '2026-07-31T08:00:00.000Z', 'fixture-meals');
    INSERT INTO catalog_products (product_id, category_id, internal_name, lifecycle_status, created_at, updated_at, status)
    VALUES ('product_fixture', 'cat_fixture', 'fixture-meal', 'published', '2026-07-31T08:00:00.000Z', '2026-07-31T08:00:00.000Z', 'published');
    INSERT INTO catalog_product_versions (product_version_id, product_id, version_number, display_name, pos_name, selling_price, is_active, published_at, created_at, description)
    VALUES ('product_version_fixture', 'product_fixture', 1, 'Fixture Meal', 'Fixture', 18000, 1, '2026-07-31T08:10:00.000Z', '2026-07-31T08:00:00.000Z', 'Upgrade fixture');
    INSERT INTO catalog_product_channels (product_channel_id, product_version_id, channel, is_enabled, created_at)
    VALUES ('product_channel_fixture', 'product_version_fixture', 'pos', 1, '2026-07-31T08:10:00.000Z');
    INSERT INTO catalog_product_drafts (product_id, display_name, pos_name, selling_price, description, updated_at)
    VALUES ('product_fixture', 'Fixture Meal', 'Fixture', 18000, 'Upgrade fixture', '2026-07-31T08:10:00.000Z');
    INSERT INTO catalog_product_draft_channels (product_id, channel, is_enabled, updated_at)
    VALUES ('product_fixture', 'pos', 1, '2026-07-31T08:10:00.000Z');

    INSERT INTO operations_events (event_id, event_name, location, starts_at, preorder_closes_at, status, created_at, updated_at, event_code, display_name, date, start_time, end_time)
    VALUES ('event_fixture', 'Fixture Service', 'Test Kitchen', '2026-07-31T10:00:00.000Z', NULL, 'closed', '2026-07-31T08:00:00.000Z', '2026-07-31T14:00:00.000Z', '20260731-01', 'Fixture Service', '2026-07-31', '10:00', '14:00');
    INSERT INTO operations_product_copies (operations_product_copy_id, product_id, product_version_id, category_id, display_name, pos_name, selling_price, channels_json, is_active, published_at, contract_version, received_at, display_category_name, display_category_sort_order)
    VALUES ('copy_fixture', 'product_fixture', 'product_version_fixture', 'cat_fixture', 'Fixture Meal', 'Fixture', 18000, '["pos"]', 1, '2026-07-31T08:10:00.000Z', '2', '2026-07-31T08:11:00.000Z', 'Fixture Meals', 1);
    INSERT INTO operations_availability (availability_id, event_id, operations_product_copy_id, channel, sellable_quantity, reserved_quantity, sold_quantity, updated_at)
    VALUES ('availability_fixture', 'event_fixture', 'copy_fixture', 'pos', 20, 0, 1, '2026-07-31T10:30:00.000Z');
    INSERT INTO operations_sellable_inventory (event_id, product_id, product_version_id, planned_quantity, reserved_quantity, sold_quantity, created_at, updated_at, safety_buffer_quantity, is_enabled)
    VALUES ('event_fixture', 'product_fixture', 'product_version_fixture', 20, 0, 1, '2026-07-31T08:20:00.000Z', '2026-07-31T10:30:00.000Z', 2, 1);
    INSERT INTO operations_orders (order_id, event_id, channel, status, subtotal, discount_total, grand_total, paid_total, idempotency_key, created_at, completed_at, order_number, source, order_status, payment_status, production_status, customer_name, customer_contact, notes, request_fingerprint, confirmed_at, cancelled_at, cancellation_reason, customer_phone_tail, payment_method, served_at, scheduled_pickup_at)
    VALUES ('order_fixture', 'event_fixture', 'pos', 'completed', 18000, 0, 18000, 18000, 'fixture-order', '2026-07-31T10:20:00.000Z', '2026-07-31T10:35:00.000Z', '001', 'pos', 'completed', 'paid', 'served', 'Fixture Guest', NULL, 'upgrade fixture', 'fixture-fingerprint', '2026-07-31T10:20:00.000Z', NULL, NULL, '1234', 'CASH', '2026-07-31T10:35:00.000Z', NULL);
    INSERT INTO operations_order_items (order_item_id, order_id, operations_product_copy_id, product_id, product_version_id, display_name_snapshot, quantity, unit_price, discount_amount, line_total, pos_name_snapshot, display_category_name_snapshot, unit_list_price, unit_selling_price, line_discount, notes, unit_cost_snapshot, bom_version_snapshot, cost_status, created_at)
    VALUES ('order_item_fixture', 'order_fixture', 'copy_fixture', 'product_fixture', 'product_version_fixture', 'Fixture Meal', 1, 18000, 0, 18000, 'Fixture', 'Fixture Meals', 18000, 18000, 0, NULL, NULL, NULL, 'not_recorded', '2026-07-31T10:20:00.000Z');
    INSERT INTO operations_payments (payment_id, order_id, payment_method, payment_status, amount, external_reference, paid_at, idempotency_key, request_fingerprint, operator, device_id, identity_trust, audit_log_id)
    VALUES ('payment_fixture', 'order_fixture', 'CASH', 'paid', 18000, NULL, '2026-07-31T10:21:00.000Z', 'fixture-payment', 'payment-fingerprint', 'owner', 'pos-1', 'operator', 'audit_fixture');
    INSERT INTO operations_order_status_events (order_status_event_id, order_id, status, actor_user_id, occurred_at, note)
    VALUES ('order_status_fixture', 'order_fixture', 'completed', 'user_owner', '2026-07-31T10:35:00.000Z', 'fixture complete');
    INSERT INTO operations_sales_outbox (sales_event_id, order_id, contract_version, payload_json, completed_at, created_at, exported_at)
    VALUES ('sales_fixture', 'order_fixture', '1', '{"orderId":"order_fixture"}', '2026-07-31T10:35:00.000Z', '2026-07-31T10:35:00.000Z', NULL);
    INSERT INTO operations_event_order_sequences (event_id, next_sequence, updated_at)
    VALUES ('event_fixture', 2, '2026-07-31T10:20:00.000Z');
    INSERT INTO operations_order_idempotency (event_id, source, idempotency_key, request_fingerprint, order_id, created_at)
    VALUES ('event_fixture', 'pos', 'fixture-order', 'fixture-fingerprint', 'order_fixture', '2026-07-31T10:20:00.000Z');
    INSERT INTO operations_inventory_releases (order_id, released_at, operator, audit_log_id)
    VALUES ('order_fixture', '2026-07-31T10:36:00.000Z', 'owner', 'audit_inventory_release');
    INSERT INTO operations_event_closures (event_id, closed_at, operator, daily_report_json, audit_log_id)
    VALUES ('event_fixture', '2026-07-31T14:00:00.000Z', 'owner', '{"orders":1}', 'audit_event_closure');
    INSERT INTO operations_event_closeouts (event_id, cash_received, line_pay_received, other_received, waste_amount, notes, updated_at, updated_by, audit_log_id)
    VALUES ('event_fixture', 18000, 0, 0, 0, 'fixture closeout', '2026-07-31T14:00:00.000Z', 'owner', 'audit_event_closeout');
    INSERT INTO operations_inventory_adjustment_batches (batch_id, event_id, idempotency_key, request_fingerprint, operator, created_at, audit_log_id)
    VALUES ('batch_fixture', 'event_fixture', 'fixture-adjustment', 'adjustment-fingerprint', 'owner', '2026-07-31T09:00:00.000Z', 'audit_adjustment');
    INSERT INTO operations_inventory_adjustments (adjustment_id, batch_id, event_id, product_id, product_version_id, planned_before, planned_after, safety_before, safety_after, enabled_before, enabled_after, created_at)
    VALUES ('adjustment_fixture', 'batch_fixture', 'event_fixture', 'product_fixture', 'product_version_fixture', 18, 20, 1, 2, 1, 1, '2026-07-31T09:00:00.000Z');
    INSERT INTO operations_event_closeout_items (event_id, product_id, product_version_id, remaining_quantity, waste_quantity, retained_quantity, updated_at)
    VALUES ('event_fixture', 'product_fixture', 'product_version_fixture', 19, 1, 18, '2026-07-31T14:00:00.000Z');

    INSERT INTO cost_ingredients (ingredient_id, canonical_name, base_unit, is_active, created_at, updated_at)
    VALUES ('legacy_cost_fixture', 'Legacy Fixture Ingredient', 'g', 1, '2026-07-31T08:00:00.000Z', '2026-07-31T08:00:00.000Z');
    INSERT INTO cost_ingredient_aliases (ingredient_alias_id, ingredient_id, alias_name, created_at)
    VALUES ('legacy_alias_fixture', 'legacy_cost_fixture', 'fixture ingredient', '2026-07-31T08:00:00.000Z');
    INSERT INTO cost_unit_conversions (unit_conversion_id, ingredient_id, from_unit, to_unit, multiplier, created_at)
    VALUES ('legacy_conversion_fixture', 'legacy_cost_fixture', 'kg', 'g', 1000.0, '2026-07-31T08:00:00.000Z');
    INSERT INTO cost_boms (bom_id, product_id, product_version_id, version_number, status, created_at, published_at)
    VALUES ('legacy_bom_fixture', 'product_fixture', 'product_version_fixture', 1, 'published', '2026-07-31T08:00:00.000Z', '2026-07-31T08:10:00.000Z');
    INSERT INTO cost_bom_items (bom_item_id, bom_id, ingredient_id, quantity, unit)
    VALUES ('legacy_bom_item_fixture', 'legacy_bom_fixture', 'legacy_cost_fixture', 100.0, 'g');
    INSERT INTO cost_sales_imports (cost_sales_import_id, sales_event_id, contract_version, payload_json, imported_at, source_completed_at)
    VALUES ('sales_import_fixture', 'sales_fixture', '1', '{"orderId":"order_fixture"}', '2026-07-31T10:40:00.000Z', '2026-07-31T10:35:00.000Z');
    INSERT INTO cost_inventory_transactions (inventory_transaction_id, ingredient_id, transaction_type, quantity, unit_cost, source_type, source_id, occurred_at, note)
    VALUES ('inventory_tx_fixture', 'legacy_cost_fixture', 'purchase', 1000.0, 20, 'fixture', 'purchase_fixture', '2026-07-31T08:00:00.000Z', 'legacy fixture only');
    INSERT INTO cost_purchases (purchase_id, receipt_number, vendor_name, purchase_date, total_amount, status, created_at)
    VALUES ('purchase_fixture', 'R-001', 'Fixture Vendor', '2026-07-31', 20000, 'accepted', '2026-07-31T08:00:00.000Z');
    INSERT INTO cost_purchase_items (purchase_item_id, purchase_id, ingredient_id, raw_name, quantity, unit, amount, review_status)
    VALUES ('purchase_item_fixture', 'purchase_fixture', 'legacy_cost_fixture', 'Fixture Ingredient', 1000.0, 'g', 20000, 'accepted');

    INSERT INTO recipe_canonical_ingredients (ingredient_id, name, category_code, status, aggregate_version, created_at, created_by, archived_at, archived_by, archive_reason)
    VALUES ('ing_00000000-0000-4000-8000-000000000001', 'Canonical Fixture Ingredient', 'fixture', 'Active', 1, '2026-07-31T08:00:00.000Z', 'owner', NULL, NULL, NULL);
    INSERT INTO recipe_canonical_ingredient_renames (ingredient_id, transition_version, previous_name, new_name, renamed_at, renamed_by, reason)
    VALUES ('ing_00000000-0000-4000-8000-000000000001', 1, 'Fixture Ingredient', 'Canonical Fixture Ingredient', '2026-07-31T08:05:00.000Z', 'owner', 'canonical naming');
    INSERT INTO cost_ingredient_cost_quotes (quote_id, ingredient_id, amount_coefficient, amount_scale, currency_code, purchase_quantity_coefficient, purchase_quantity_scale, unit_code, source_type, source_reference_id, supplier_id, effective_from, effective_to, recorded_at, recorded_by, superseded_at, superseded_by_quote_id, superseded_by_actor, aggregate_version)
    VALUES ('quote_fixture', 'ing_00000000-0000-4000-8000-000000000001', 20000, 0, 'TWD', 1000, 0, 'g', 'manual', 'fixture-quote', NULL, '2026-07-31T00:00:00.000Z', NULL, '2026-07-31T08:00:00.000Z', 'owner', NULL, NULL, NULL, 0);
  `);
}

function tableSnapshot(database) {
  const tables = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'
    ORDER BY name
  `).all().map((row) => row.name);
  const snapshot = {};
  for (const table of tables) {
    const tableName = quoteIdentifier(table);
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    const primaryKey = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk).map((column) => column.name);
    const orderColumns = primaryKey.length > 0 ? primaryKey : columns.map((column) => column.name);
    const orderBy = orderColumns.map(quoteIdentifier).join(", ");
    const rows = database.prepare(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`).all();
    snapshot[table] = { columns: columns.map((column) => column.name), rows };
  }
  return snapshot;
}

function assertForeignKeys(database, label) {
  const failures = database.prepare("PRAGMA foreign_key_check").all();
  assert(failures.length === 0, `${label}: foreign_key_check returned ${JSON.stringify(failures)}`);
}

function assertIntegrity(database, label) {
  const result = database.prepare("PRAGMA integrity_check").pluck().get();
  assert(result === "ok", `${label}: integrity_check returned ${String(result)}`);
}

function insertAndVerifyNewAuthorityTables(database) {
  database.transaction(() => database.exec(`
    INSERT INTO recipe_ingredient_measurement_profiles (profile_id, ingredient_id, aggregate_version, created_at, created_by)
    VALUES ('measurement_profile_fixture', 'ing_00000000-0000-4000-8000-000000000001', 1, '2026-07-31T08:20:00.000Z', 'owner');
    INSERT INTO recipe_ingredient_measurement_profile_versions (profile_version_id, profile_id, ingredient_id, version_position, state, dimension, canonical_unit_code, allowed_unit_codes_json, profile_aliases_json, source_type, source_reference_id, source_recorded_at, source_recorded_by, effective_from, effective_to, superseding_profile_version_id, lifecycle_json)
    VALUES ('measurement_profile_version_fixture', 'measurement_profile_fixture', 'ing_00000000-0000-4000-8000-000000000001', 1, 'Active', 'mass', 'g', '["g","kg"]', '[]', 'MANUAL', 'fixture-profile', '2026-07-31T08:20:00.000Z', 'owner', '2026-07-31T08:20:00.000Z', NULL, NULL, '{"state":"Active"}');

    INSERT INTO recipe_recipes (recipe_id, recipe_family_id, product_id, current_draft_id, current_recipe_version_id, aggregate_version, state)
    VALUES ('recipe_00000000-0000-4000-8000-000000000010', 'recipe_family_00000000-0000-4000-8000-000000000010', 'product_fixture', 'recipe_draft_fixture', NULL, 1, 'Draft');
    INSERT INTO recipe_drafts (draft_id, recipe_id, recipe_family_id, name, state, product_id, product_version_id, instructions, standard_output_coefficient, standard_output_scale, standard_output_unit_code, standard_output_dimension, standard_yield_coefficient, standard_yield_scale, standard_yield_unit_code, standard_yield_dimension, created_by, created_at)
    VALUES ('recipe_draft_fixture', 'recipe_00000000-0000-4000-8000-000000000010', 'recipe_family_00000000-0000-4000-8000-000000000010', 'Fixture Recipe', 'Draft', 'product_fixture', 'product_version_fixture', 'Prepare carefully', '100', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', '2026-07-31T08:30:00.000Z');
    INSERT INTO recipe_draft_lines (draft_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note)
    VALUES ('recipe_draft_fixture', 'recipe_line_00000000-0000-4000-8000-000000000011', 0, 'ing_00000000-0000-4000-8000-000000000001', 'Canonical Fixture Ingredient', 'mass', 'active', '2026-07-31T08:00:00.000Z', '100', 0, 'g', 'mass', 'Trim');
    INSERT INTO recipe_versions (recipe_version_id, recipe_id, recipe_family_id, source_draft_id, version_number, state, name, product_id, product_version_id, instructions, standard_output_coefficient, standard_output_scale, standard_output_unit_code, standard_output_dimension, standard_yield_coefficient, standard_yield_scale, standard_yield_unit_code, standard_yield_dimension, published_by, published_at)
    VALUES ('recipe_version_fixture', 'recipe_00000000-0000-4000-8000-000000000010', 'recipe_family_00000000-0000-4000-8000-000000000010', 'recipe_draft_fixture', 1, 'Published', 'Fixture Recipe', 'product_fixture', 'product_version_fixture', 'Prepare carefully', '100', 0, 'g', 'mass', '1', 0, 'each', 'count', 'owner', '2026-07-31T08:40:00.000Z');
    INSERT INTO recipe_version_lines (recipe_version_id, recipe_line_id, position, ingredient_id, ingredient_canonical_name, ingredient_measurement_dimension, ingredient_status, ingredient_created_at, quantity_coefficient, quantity_scale, quantity_unit_code, quantity_dimension, preparation_note)
    VALUES ('recipe_version_fixture', 'recipe_line_00000000-0000-4000-8000-000000000011', 0, 'ing_00000000-0000-4000-8000-000000000001', 'Canonical Fixture Ingredient', 'mass', 'active', '2026-07-31T08:00:00.000Z', '100', 0, 'g', 'mass', 'Trim');
    INSERT INTO recipe_publish_audits (event_key, recipe_family_id, recipe_id, draft_id, recipe_version_id, version_number, actor, occurred_at, reason)
    VALUES ('recipe.publish.fixture', 'recipe_family_00000000-0000-4000-8000-000000000010', 'recipe_00000000-0000-4000-8000-000000000010', 'recipe_draft_fixture', 'recipe_version_fixture', 1, 'owner', '2026-07-31T08:40:00.000Z', 'Initial publication');
    UPDATE recipe_drafts SET state = 'Published' WHERE draft_id = 'recipe_draft_fixture';
    UPDATE recipe_recipes SET current_recipe_version_id = 'recipe_version_fixture', aggregate_version = 2, state = 'Published' WHERE recipe_id = 'recipe_00000000-0000-4000-8000-000000000010';
  `))();
  assert(database.prepare("SELECT COUNT(*) AS count FROM recipe_ingredient_measurement_profile_versions WHERE state = 'Active'").get().count === 1, "active Measurement Profile Version was not persisted");
  assert(database.prepare("SELECT COUNT(*) AS count FROM recipe_versions").get().count === 1, "published Recipe Version was not persisted");
}

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "ros-upgrade-014-"));
const databasePath = path.join(temporaryDirectory, "existing-014.sqlite");
let historicalDatabase;
let adapter;
let upgradedDatabase;

try {
  assert(migrationFiles.length > through014.length, "repository has no migrations after the historical 014 fixture");
  assert(through014.length === 14, `expected 14 historical migrations, found ${through014.length}`);

  historicalDatabase = openDatabase(databasePath);
  applyHistoricalMigrations(historicalDatabase);
  seedPopulated014Fixture(historicalDatabase);
  assertForeignKeys(historicalDatabase, "before upgrade");
  assertIntegrity(historicalDatabase, "before upgrade");

  const beforeMigrations = historicalDatabase.prepare("SELECT migration_id FROM schema_migrations ORDER BY migration_id").pluck().all();
  assert(JSON.stringify(beforeMigrations) === JSON.stringify(through014), "fixture is not exactly at migration 014");
  const beforeSnapshot = tableSnapshot(historicalDatabase);
  const populatedTables = Object.entries(beforeSnapshot).filter(([, value]) => value.rows.length > 0).map(([name]) => name);
  for (const prefix of ["catalog_", "operations_", "cost_", "recipe_canonical_"]) {
    assert(populatedTables.some((name) => name.startsWith(prefix)), `fixture has no populated ${prefix} table`);
  }
  assert(beforeSnapshot.users.rows.length > 0, "fixture has no populated System authority table");
  const beforeSnapshotJson = JSON.stringify(beforeSnapshot);
  const beforeDigest = digest(beforeSnapshotJson);
  historicalDatabase.close();
  historicalDatabase = undefined;

  adapter = new BetterSqlite3Adapter(databasePath);
  const appliedNow = runMigrations(adapter);
  assert(JSON.stringify(appliedNow) === JSON.stringify(expectedUpgrade), `unexpected upgrade set: ${JSON.stringify(appliedNow)}`);
  adapter.close();
  adapter = undefined;

  upgradedDatabase = openDatabase(databasePath);
  const afterSnapshot = tableSnapshot(upgradedDatabase);
  const migratedLifecycleTable = "recipe_canonical_ingredient_renames";
  const authenticationProjectionTables = new Set(["users", "roles"]);
  for (const table of Object.keys(beforeSnapshot).filter((name) => name !== migratedLifecycleTable && !authenticationProjectionTables.has(name))) {
    assert(JSON.stringify(afterSnapshot[table]) === JSON.stringify(beforeSnapshot[table]), `pre-existing table changed during upgrade: ${table}`);
  }
  const preservedBeforeSnapshot = Object.fromEntries(Object.entries(beforeSnapshot).filter(([name]) => name !== migratedLifecycleTable && !authenticationProjectionTables.has(name)));
  const preservedAfterSnapshot = Object.fromEntries(Object.keys(preservedBeforeSnapshot).map((table) => [table, afterSnapshot[table]]));
  const afterDigest = digest(JSON.stringify(preservedAfterSnapshot));
  assert(afterDigest === digest(JSON.stringify(preservedBeforeSnapshot)), "pre-existing SQL-value snapshot digest changed during upgrade");
  assert(JSON.stringify(upgradedDatabase.prepare("SELECT user_id, login, display_name, status, created_at, password_algorithm, password_salt, password_hash, password_changed_at FROM users WHERE user_id = 'user_owner'").get()) === JSON.stringify({
    user_id: "user_owner", login: "owner", display_name: "Owner", status: "active", created_at: "2026-07-31T08:00:00.000Z",
    password_algorithm: null, password_salt: null, password_hash: null, password_changed_at: null
  }), "legacy user projection was not preserved with empty credential fields");
  assert(JSON.stringify(upgradedDatabase.prepare("SELECT code FROM roles ORDER BY code").pluck().all()) === JSON.stringify(["admin", "closeout", "kitchen", "pos"]), "governed local roles were not added deterministically");
  assert(upgradedDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'system_auth_sessions'").get()?.name === "system_auth_sessions", "AuthenticationRoleBoundary session ledger was not created");

  const canonicalIngredient = upgradedDatabase.prepare("SELECT ingredient_id, name, category_code, status, aggregate_version, created_at, created_by, archived_at, archived_by, archive_reason FROM recipe_canonical_ingredients WHERE ingredient_id = ?")
    .get("ing_00000000-0000-4000-8000-000000000001");
  assert(JSON.stringify(canonicalIngredient) === JSON.stringify({
    ingredient_id: "ing_00000000-0000-4000-8000-000000000001",
    name: "Canonical Fixture Ingredient",
    category_code: "fixture",
    status: "Active",
    aggregate_version: 1,
    created_at: "2026-07-31T08:00:00.000Z",
    created_by: "owner",
    archived_at: null,
    archived_by: null,
    archive_reason: null
  }), "canonical Ingredient projection changed during lifecycle-ledger upgrade");
  assert(JSON.stringify(upgradedDatabase.prepare("SELECT aggregate_version, event_type, occurred_at, actor, reason, previous_name, new_name FROM recipe_canonical_ingredient_lifecycle_events WHERE ingredient_id = ? ORDER BY aggregate_version").all("ing_00000000-0000-4000-8000-000000000001")) === JSON.stringify([{
    aggregate_version: 1,
    event_type: "RENAMED",
    occurred_at: "2026-07-31T08:05:00.000Z",
    actor: "owner",
    reason: "canonical naming",
    previous_name: "Fixture Ingredient",
    new_name: "Canonical Fixture Ingredient"
  }]), "canonical Ingredient lifecycle evidence was not replayed into the authoritative ledger");

  const afterMigrations = upgradedDatabase.prepare("SELECT migration_id FROM schema_migrations ORDER BY migration_id").pluck().all();
  assert(JSON.stringify(afterMigrations) === JSON.stringify(migrationFiles), "database did not reach the repository's full migration set");
  const requiredNewTables = [
    "recipe_ingredient_measurement_profiles",
    "recipe_ingredient_measurement_profile_versions",
    "recipe_recipes",
    "recipe_drafts",
    "recipe_draft_lines",
    "recipe_versions",
    "recipe_version_lines",
    "recipe_publish_audits",
    "recipe_supersession_audits",
    "recipe_creation_audits",
    "recipe_abandonment_audits",
    "recipe_command_receipts",
    "recipe_canonical_ingredient_lifecycle_events"
  ];
  const actualNewTables = new Set(upgradedDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all());
  for (const table of requiredNewTables) assert(actualNewTables.has(table), `missing upgraded table: ${table}`);
  const requiredNewIndexes = [
    "recipe_measurement_profiles_one_active",
    "recipe_measurement_profiles_effective_lookup",
    "recipe_versions_latest",
    "recipe_drafts_by_recipe"
    ,"recipe_recipes_one_bound_product"
  ];
  const actualNewIndexes = new Set(upgradedDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").pluck().all());
  for (const index of requiredNewIndexes) assert(actualNewIndexes.has(index), `missing upgraded index: ${index}`);
  insertAndVerifyNewAuthorityTables(upgradedDatabase);
  assertForeignKeys(upgradedDatabase, "after upgrade writes");
  assertIntegrity(upgradedDatabase, "after upgrade writes");
  upgradedDatabase.close();
  upgradedDatabase = undefined;

  upgradedDatabase = openDatabase(databasePath);
  assert(upgradedDatabase.prepare("SELECT state FROM recipe_ingredient_measurement_profile_versions WHERE profile_version_id = ?").pluck().get("measurement_profile_version_fixture") === "Active", "Measurement Profile did not survive restart");
  assert(upgradedDatabase.prepare("SELECT state FROM recipe_recipes WHERE recipe_id = ?").pluck().get("recipe_00000000-0000-4000-8000-000000000010") === "Published", "Recipe did not survive restart");
  assert(upgradedDatabase.prepare("SELECT quote_id FROM cost_ingredient_cost_quotes WHERE quote_id = ?").pluck().get("quote_fixture") === "quote_fixture", "pre-existing Quote did not survive restart");
  assertForeignKeys(upgradedDatabase, "after restart");
  assertIntegrity(upgradedDatabase, "after restart");
  upgradedDatabase.close();
  upgradedDatabase = undefined;

  adapter = new BetterSqlite3Adapter(databasePath);
  assert(runMigrations(adapter).length === 0, "migration rerun was not idempotent");
  adapter.close();
  adapter = undefined;

  console.log(JSON.stringify({
    verdict: "PASS",
    fixture: "populated existing database at migration 014",
    historicalMigrations: through014.length,
    appliedUpgrade: expectedUpgrade,
    preExistingTables: Object.keys(beforeSnapshot).length,
    populatedPreExistingTables: populatedTables.length,
    preExistingRowCount: Object.values(beforeSnapshot).reduce((sum, value) => sum + value.rows.length, 0),
    preExistingSnapshotSha256: beforeDigest,
    preExistingRowsUnchanged: true,
    foreignKeyCheck: "PASS",
    integrityCheck: "PASS",
    restartPersistence: "PASS",
    migrationRerun: "PASS",
    repositoryDatabaseWritten: false
  }, null, 2));
} finally {
  try { historicalDatabase?.close(); } catch {}
  try { adapter?.close(); } catch {}
  try { upgradedDatabase?.close(); } catch {}
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
