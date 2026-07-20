import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";

test("ADR-014 recovery migration translates legacy lifecycle states idempotently", () => {
  const database = createDatabase({ host: "127.0.0.1", port: 0, databasePath: path.resolve("data", `adr014-${randomUUID()}.sqlite`) });
  runMigrations(database);
  database.execute("INSERT INTO operations_events (event_id, event_name, starts_at, event_code, display_name, date, start_time, end_time, status, created_at, updated_at) VALUES ('event_1', 'ADR Recovery', '2026-07-20T17:00:00.000Z', 'ADR', 'ADR Recovery', '2026-07-20', '17:00', '22:00', 'closed', '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z')");
  const insert = "INSERT INTO operations_orders (order_id, event_id, channel, status, subtotal, discount_total, grand_total, paid_total, created_at, order_number, source, order_status, payment_status, production_status) VALUES (?, 'event_1', 'pos', ?, 0, 0, 0, 0, '2026-07-20T00:00:00.000Z', ?, 'pos', ?, 'unpaid', 'not_started')";
  database.execute(insert, ["order_cooking", "cooking", "ADR-001", "cooking"]);
  database.execute(insert, ["order_ready", "ready", "ADR-002", "ready"]);
  database.execute(insert, ["order_no_show", "no_show", "ADR-003", "no_show"]);
  database.execute("INSERT INTO audit_logs (audit_log_id, entity_type, entity_id, action, after_json, occurred_at) VALUES ('audit_no_show', 'order', 'order_no_show', 'no_show', '{\"from\":\"ready\",\"to\":\"no_show\"}', '2026-07-20T18:00:00.000Z')");
  const sql = readFileSync(path.resolve("migrations/006_restore_adr014_state_separation.sql"), "utf8");
  database.execute(sql); database.execute(sql);
  assert.deepEqual(database.queryOne("SELECT order_status, production_status, cancellation_reason FROM operations_orders WHERE order_id = 'order_cooking'"), { order_status: "confirmed", production_status: "preparing", cancellation_reason: null });
  assert.deepEqual(database.queryOne("SELECT order_status, production_status, cancellation_reason, cancelled_at FROM operations_orders WHERE order_id = 'order_ready'"), { order_status: "confirmed", production_status: "ready", cancellation_reason: null, cancelled_at: null });
  assert.deepEqual(database.queryOne("SELECT order_status, production_status, cancellation_reason, cancelled_at FROM operations_orders WHERE order_id = 'order_no_show'"), { order_status: "cancelled", production_status: "ready", cancellation_reason: "no_show", cancelled_at: "2026-07-20T18:00:00.000Z" });
  database.close();
});
