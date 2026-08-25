import type { DailyReport, PaymentCloseoutReconciliation } from "./types.js";

/** Operations-owned, read-only access to immutable Event-close evidence. */
export type DailyReportEvidenceSummary = Readonly<{
  event: DailyReport["event"];
  orders: DailyReport["orders"];
  payments: DailyReport["payments"];
  paymentReconciliation: PaymentCloseoutReconciliation | null;
  closedAt: string;
}>;

export interface DailyReportReadPort {
  findDailyReport(eventId: string): DailyReport | undefined;
  listDailyReports(): readonly DailyReport[];
}
