import { HttpError } from "../../../shared/errors/http-error.js";
import { createId } from "../../../shared/utils/ids.js";
import type { DailyReport, OrderStatus } from "../domain/types.js";
import { LifecycleRepository, type LifecycleOrder } from "../infrastructure/lifecycle-repository.js";

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = { pending: ["cooking", "cancelled", "no_show"], cooking: ["ready", "cancelled", "no_show"], ready: ["completed", "cancelled", "no_show"], completed: [], cancelled: [], no_show: [] };
function now(): string { return new Date().toISOString(); }
function operator(value: unknown): string { return typeof value === "string" && value.trim() ? value.trim() : "local-pos"; }
function terminal(status: OrderStatus): boolean { return status === "completed" || status === "cancelled" || status === "no_show"; }

export class LifecycleService {
  constructor(private readonly repository: LifecycleRepository) {}
  listEventOrders(eventId: string): LifecycleOrder[] { return this.repository.listEventOrders(eventId); }
  changeStatus(orderId: string, input: unknown): LifecycleOrder {
    const target = (input as Record<string, unknown>)?.status;
    if (typeof target !== "string" || !["cooking", "ready", "completed", "cancelled"].includes(target)) throw new HttpError(400, "VALIDATION_ERROR", "Choose a supported lifecycle status.");
    return this.transition(orderId, target as OrderStatus, operator((input as Record<string, unknown>)?.operator), "status_changed");
  }
  markNoShow(orderId: string, input: unknown): LifecycleOrder { return this.transition(orderId, "no_show", operator((input as Record<string, unknown>)?.operator), "no_show"); }
  private transition(orderId: string, target: OrderStatus, actor: string, action: string): LifecycleOrder {
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (terminal(order.orderStatus) || !transitions[order.orderStatus].includes(target)) throw new HttpError(409, "ILLEGAL_STATUS_TRANSITION", "This Order status transition is not allowed.");
      const timestamp = now();
      if (!this.repository.updateStatus(orderId, order.orderStatus, target, timestamp)) throw new HttpError(409, "ORDER_CONCURRENTLY_CHANGED", "Order changed concurrently; refresh and retry.");
      this.repository.insertAudit({ auditLogId: createId("audit_"), entityType: "order", entityId: orderId, action, metadata: { operator: actor, eventId: order.eventId, orderId, from: order.orderStatus, to: target }, occurredAt: timestamp });
      return { ...order, orderStatus: target };
    });
  }
  releaseInventory(orderId: string, input: unknown): { order: LifecycleOrder; released: boolean } {
    if ((input as Record<string, unknown>)?.confirmed !== true) throw new HttpError(400, "RELEASE_CONFIRMATION_REQUIRED", "Release Inventory requires confirmed=true.");
    const actor = operator((input as Record<string, unknown>)?.operator);
    return this.repository.transactionImmediate(() => {
      const order = this.repository.findOrder(orderId); if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
      if (order.orderStatus !== "no_show") throw new HttpError(409, "RELEASE_ONLY_FOR_NO_SHOW", "Only no_show Orders may release inventory.");
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
      const unresolved = this.repository.unresolvedCount(eventId); if (unresolved) throw new HttpError(409, "EVENT_CLOSE_BLOCKED", "Resolve all pending, cooking, and ready Orders first.", { unresolved: String(unresolved) });
      const timestamp = now(); const report = this.repository.buildReport(event, timestamp); const auditLogId = createId("audit_");
      this.repository.insertAudit({ auditLogId, entityType: "event", entityId: eventId, action: "event_closed", metadata: { operator: actor, eventId, report }, occurredAt: timestamp });
      this.repository.insertClosure(eventId, report, timestamp, actor, auditLogId);
      if (!this.repository.closeEvent(eventId, timestamp)) throw new HttpError(409, "EVENT_CONCURRENTLY_CLOSED", "Event changed concurrently; refresh and retry.");
      return { report, replayed: false };
    });
  }
  getDailyReport(eventId: string): DailyReport { const report = this.repository.findClosure(eventId); if (!report) throw new HttpError(404, "DAILY_REPORT_NOT_FOUND", "Daily report is available after Event Close."); return report; }
}
