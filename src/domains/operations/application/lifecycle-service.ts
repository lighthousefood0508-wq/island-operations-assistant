import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type { DailyReport, ProductionStatus } from "../domain/types.js";
import { LifecycleRepository, type LifecycleOrder } from "../infrastructure/lifecycle-repository.js";

const productionTransitions: Readonly<Record<ProductionStatus, readonly ProductionStatus[]>> = {
  not_started: ["queued", "preparing"],
  queued: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "cancelled"],
  served: [],
  cancelled: []
};
function now(): string { return new Date().toISOString(); }
function operator(value: unknown): string { return typeof value === "string" && value.trim() ? value.trim() : "local-pos"; }
function terminal(status: "draft" | "submitted" | "confirmed" | "completed" | "cancelled"): boolean { return status === "completed" || status === "cancelled"; }

export class LifecycleService {
  constructor(private readonly repository: LifecycleRepository) {}
  listEventOrders(eventId: string): LifecycleOrder[] { return this.repository.listEventOrders(eventId); }
  changeStatus(orderId: string, input: unknown): LifecycleOrder {
    const target = (input as Record<string, unknown>)?.status;
    if (typeof target !== "string" || !["preparing", "ready", "served", "completed", "cancelled"].includes(target)) throw new HttpError(400, "VALIDATION_ERROR", "Choose a supported lifecycle status.");
    const actor = operator((input as Record<string, unknown>)?.operator);
    if (target === "completed") return this.completeOrder(orderId, actor);
    if (target === "cancelled") return this.cancelOrder(orderId, actor, null, "status_changed");
    return this.transitionProduction(orderId, target as ProductionStatus, actor);
  }
  markNoShow(orderId: string, input: unknown): LifecycleOrder { return this.cancelOrder(orderId, operator((input as Record<string, unknown>)?.operator), "no_show", "order.no_show"); }
  private transitionProduction(orderId: string, target: ProductionStatus, actor: string): LifecycleOrder {
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (terminal(order.orderStatus) || !productionTransitions[order.productionStatus].includes(target)) throw new HttpError(409, "ILLEGAL_STATUS_TRANSITION", "This Production status transition is not allowed.");
      const timestamp = now();
      if (!this.repository.updateProductionStatus(orderId, order.productionStatus, target, timestamp)) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "Order changed concurrently; refresh and retry.");
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityType: "order", entityId: orderId, action: "production_status_changed", metadata: { operator: actor, eventId: order.eventId, orderId, from: order.productionStatus, to: target }, occurredAt: timestamp });
      return { ...order, productionStatus: target, servedAt: target === "served" ? timestamp : order.servedAt };
    });
  }
  private completeOrder(orderId: string, actor: string): LifecycleOrder {
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (order.orderStatus !== "confirmed") throw new HttpError(409, "ILLEGAL_STATUS_TRANSITION", "Only confirmed Orders may complete.");
      if (order.paymentStatus !== "paid" || order.productionStatus !== "served") throw new HttpError(409, "ORDER_COMPLETION_REQUIREMENTS_NOT_MET", "Order completion requires paid payment and served production.");
      const timestamp = now();
      if (!this.repository.completeOrder(orderId, timestamp)) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "Order changed concurrently; refresh and retry.");
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityType: "order", entityId: orderId, action: "order_status_changed", metadata: { operator: actor, eventId: order.eventId, orderId, from: "confirmed", to: "completed" }, occurredAt: timestamp });
      return { ...order, orderStatus: "completed" };
    });
  }
  private cancelOrder(orderId: string, actor: string, reason: string | null, action: string): LifecycleOrder {
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (terminal(order.orderStatus) || !["draft", "submitted", "confirmed"].includes(order.orderStatus)) throw new HttpError(409, "ILLEGAL_STATUS_TRANSITION", "This Order status transition is not allowed.");
      const timestamp = now();
      if (!this.repository.cancelOrder(orderId, order.orderStatus, reason, timestamp)) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "Order changed concurrently; refresh and retry.");
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityType: "order", entityId: orderId, action, metadata: { operator: actor, eventId: order.eventId, orderId, from: order.orderStatus, to: "cancelled", cancellationReason: reason }, occurredAt: timestamp });
      return { ...order, orderStatus: "cancelled", cancellationReason: reason };
    });
  }
  releaseInventory(orderId: string, input: unknown): { order: LifecycleOrder; released: boolean } {
    if ((input as Record<string, unknown>)?.confirmed !== true) throw new HttpError(400, "RELEASE_CONFIRMATION_REQUIRED", "Release Inventory requires confirmed=true.");
    const actor = operator((input as Record<string, unknown>)?.operator);
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (order.orderStatus !== "cancelled" || order.cancellationReason !== "no_show") throw new HttpError(409, "RELEASE_ONLY_FOR_NO_SHOW", "Only cancelled Orders with cancellationReason=no_show may release inventory.");
      if (order.productionStatus !== "not_started") throw new HttpError(409, "RELEASE_AFTER_PRODUCTION_FORBIDDEN", "Prepared Orders cannot release sellable quantity.");
      if (this.repository.hasRelease(orderId)) return { order, released: false };
      const timestamp = now();
      if (!this.repository.releaseItems(orderId, order.eventId, timestamp)) throw new HttpError(409, "INVENTORY_RELEASE_FAILED", "Inventory could not be released safely.");
      const auditLogId = createId("audit_"); this.repository.insertRelease(orderId, timestamp, actor, auditLogId);
      this.repository.insertAudit({ auditLogId, entityType: "order", entityId: orderId, action: "inventory_released", metadata: { operator: actor, eventId: order.eventId, orderId }, occurredAt: timestamp });
      return { order, released: true };
    });
  }
  closeEvent(eventId: string, input: unknown): { report: DailyReport; replayed: boolean } {
    if ((input as Record<string, unknown>)?.confirmed !== true) throw new HttpError(400, "EVENT_CLOSE_CONFIRMATION_REQUIRED", "Event Close requires confirmed=true.");
    const actor = operator((input as Record<string, unknown>)?.operator);
    return this.repository.transactionImmediate(() => {
      const closed = this.repository.findClosure(eventId); if (closed) return { report: closed, replayed: true };
      const event = this.repository.findEvent(eventId); if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
      if (event.status !== "open") throw new HttpError(409, "EVENT_NOT_OPEN", "Only an OPEN Event can be closed.");
      const unresolved = this.repository.unresolvedCount(eventId); if (unresolved) throw new HttpError(409, "EVENT_CLOSE_BLOCKED", "Resolve all non-terminal Orders first.", { unresolved: String(unresolved) });
      const timestamp = now(); const report = this.repository.buildReport(event, timestamp); const auditLogId = createId("audit_");
      this.repository.insertAudit({ auditLogId, entityType: "event", entityId: eventId, action: "event_closed", metadata: { operator: actor, eventId, report }, occurredAt: timestamp });
      this.repository.insertClosure(eventId, report, timestamp, actor, auditLogId);
      if (!this.repository.closeEvent(eventId, timestamp)) throw new HttpError(409, "EVENT_CONCURRENTLY_CLOSED", "Event changed concurrently; refresh and retry.");
      return { report, replayed: false };
    });
  }
  getDailyReport(eventId: string): DailyReport { const report = this.repository.findClosure(eventId); if (!report) throw new HttpError(404, "DAILY_REPORT_NOT_FOUND", "Daily report is available after Event Close."); return report; }
  getStatistics(eventId: string): Record<string, unknown> { const result = this.repository.getStatistics(eventId); if (!Object.keys(result).length) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found."); return result; }
  saveCloseout(eventId: string, input: unknown): Record<string, unknown> {
    const value = input as Record<string, unknown>; const amount = (key: string) => Number.isSafeInteger(value?.[key]) && (value[key] as number) >= 0 ? value[key] as number : null;
    const cashReceived = amount("cashReceived"), linePayReceived = amount("linePayReceived"), otherReceived = amount("otherReceived"), wasteAmount = amount("wasteAmount");
    if (cashReceived === null || linePayReceived === null || otherReceived === null || wasteAmount === null) throw new HttpError(400, "VALIDATION_ERROR", "Closeout amounts must be non-negative integers.");
    const event = this.repository.findEvent(eventId); if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Event was not found.");
    const timestamp = now(); const actor = operator(value?.operator); const auditLogId = createId("audit_"); const notes = typeof value?.notes === "string" ? value.notes.slice(0, 1000) : "";
    this.repository.transactionImmediate(() => { this.repository.saveCloseout(eventId, { cashReceived, linePayReceived, otherReceived, wasteAmount, notes, updatedAt: timestamp, operator: actor, auditLogId }); this.repository.insertAudit({ auditLogId, entityType: "event", entityId: eventId, action: "closeout_updated", metadata: { operator: actor, eventId }, occurredAt: timestamp }); });
    return this.getStatistics(eventId);
  }
}
