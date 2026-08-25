import type { DailyReportReadPort } from "../domain/daily-report-read-port.js";
import type { DailyReport } from "../domain/types.js";
import {
  DailyReportReadNotFound,
  DailyReportReadPersistenceFailure,
  DailyReportReadValidationFailure
} from "./daily-report-read-errors.js";

function summary(report: DailyReport) {
  return Object.freeze({
    event: report.event,
    orders: report.orders,
    payments: report.payments,
    paymentReconciliation: report.paymentReconciliation,
    closedAt: report.closedAt
  });
}

/** DailyReportSalesContractReadBoundary: coordinates immutable Operations close evidence only. */
export class DailyReportReadService {
  constructor(private readonly reads: DailyReportReadPort) {}

  listDailyReports() {
    return this.read(() => Object.freeze(this.reads.listDailyReports().map(summary)));
  }

  getDailyReport(eventId: string): DailyReport {
    if (typeof eventId !== "string" || eventId.trim().length === 0) {
      throw new DailyReportReadValidationFailure();
    }
    const report = this.read(() => this.reads.findDailyReport(eventId));
    if (report === undefined) throw new DailyReportReadNotFound();
    return report;
  }

  private read<T>(work: () => T): T {
    try {
      return work();
    } catch (error) {
      if (error instanceof DailyReportReadValidationFailure || error instanceof DailyReportReadNotFound) throw error;
      throw new DailyReportReadPersistenceFailure();
    }
  }
}
