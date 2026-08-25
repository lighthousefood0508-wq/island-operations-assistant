import assert from "node:assert/strict";
import test from "node:test";
import {
  DailyReportReadNotFound,
  DailyReportReadPersistenceFailure,
  DailyReportReadService,
  DailyReportReadValidationFailure,
  type DailyReport,
  type DailyReportReadPort
} from "../domains/operations/index.js";

function report(eventId = "event-a", closedAt = "2026-08-25T10:00:00.000Z"): DailyReport {
  return Object.freeze({
    event: Object.freeze({ eventId, eventCode: eventId, displayName: eventId, date: "2026-08-25", startTime: "10:00", endTime: "12:00" }),
    orders: Object.freeze({ total: 1, completed: 1, cancelled: 0, noShow: 0 }),
    products: Object.freeze([]), payments: Object.freeze({ cash: 100, linePay: 0, other: 0 }),
    paymentReconciliation: null, closedAt
  });
}

function reads(overrides: Partial<DailyReportReadPort> = {}): DailyReportReadPort {
  return { findDailyReport: () => undefined, listDailyReports: () => Object.freeze([]), ...overrides };
}

test("Daily Report read service returns immutable close evidence and deterministic summaries", () => {
  const first = report("event-a", "2026-08-25T10:00:00.000Z");
  const second = report("event-b", "2026-08-25T09:00:00.000Z");
  const service = new DailyReportReadService(reads({
    findDailyReport: (eventId) => eventId === "event-a" ? first : undefined,
    listDailyReports: () => Object.freeze([first, second])
  }));
  assert.equal(service.getDailyReport("event-a"), first);
  assert.deepEqual(service.listDailyReports(), [
    { event: first.event, orders: first.orders, payments: first.payments, paymentReconciliation: null, closedAt: first.closedAt },
    { event: second.event, orders: second.orders, payments: second.payments, paymentReconciliation: null, closedAt: second.closedAt }
  ]);
});

test("Daily Report read service contains invalid, missing, and technical read failures", () => {
  const missing = new DailyReportReadService(reads());
  assert.throws(() => missing.getDailyReport(""), DailyReportReadValidationFailure);
  assert.throws(() => missing.getDailyReport("event-missing"), DailyReportReadNotFound);
  const failed = new DailyReportReadService(reads({ listDailyReports: () => { throw new Error("raw SQLite table detail"); } }));
  assert.throws(() => failed.listDailyReports(), DailyReportReadPersistenceFailure);
});
