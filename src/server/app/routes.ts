import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CatalogService } from "../../domains/catalog/index.js";
import { LifecycleService, OperationsService, OrderService } from "../../domains/operations/index.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { SseHub } from "../events/sse.js";
import { renderAnalysisPlaceholder } from "../../web/analysis/page.js";
import { renderCatalogAdmin } from "../../web/catalog/page.js";
import { renderEventsAdmin } from "../../web/events/page.js";
import { renderHealthDashboard } from "../../web/health/page.js";
import { renderKitchen } from "../../web/kitchen/page.js";
import { renderOrdering } from "../../web/ordering/page.js";
import { renderPos } from "../../web/pos/page.js";
import { renderLifecycle } from "../../web/lifecycle/page.js";
import { renderStatistics } from "../../web/statistics/page.js";
import { renderDevicesDebug } from "../../web/devices/page.js";

type Services = Readonly<{ catalog: CatalogService; operations: OperationsService; orders: OrderService; lifecycle: LifecycleService }>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function sendMockup(response: ServerResponse, filename: string): void {
  sendHtml(response, readFileSync(path.resolve(process.cwd(), "mockups", filename), "utf8"));
}

function success(response: ServerResponse, status: number, data: unknown): void {
  sendJson(response, status, { ok: true, data });
}

function failure(response: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(response, error.status, { ok: false, error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  console.error(error);
  sendJson(response, 500, { ok: false, error: { code: "internal_error", message: "An unexpected server error occurred." } });
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100_000) throw new HttpError(413, "payload_too_large", "Request body is too large.");
    chunks.push(buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not object");
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object.");
  }
}

function telemetryPart(value: string | null, fallback: string): string {
  return /^[A-Za-z0-9-]{1,32}$/.test(value || "") ? value as string : fallback;
}

export function createRoute(services: Services, events: SseHub): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => { void route(request, response, services, events); };
}

async function route(request: IncomingMessage, response: ServerResponse, services: Services, events: SseHub): Promise<void> {
  const url = new URL(request.url || "/", "http://localhost");
  const { pathname } = url;
  try {
    if (request.method === "GET" && pathname === "/health") return success(response, 200, { status: "ok", service: "desert-island-ros", database: "ready", now: new Date().toISOString() });
    if (request.method === "GET" && pathname === "/events") {
      events.connect(response, { deviceId: telemetryPart(url.searchParams.get("device"), "unknown"), page: telemetryPart(url.searchParams.get("page"), "unknown") });
      response.once("error", () => events.disconnect(response));
      return;
    }
    if (request.method === "GET" && pathname === "/admin") return sendHtml(response, renderEventsAdmin());
    if (request.method === "GET" && pathname === "/admin/events") return sendHtml(response, renderEventsAdmin());
    if (request.method === "GET" && pathname === "/admin/catalog") return sendHtml(response, renderCatalogAdmin());
    if (request.method === "GET" && pathname === "/admin/analysis") return sendHtml(response, renderAnalysisPlaceholder());
    if (request.method === "GET" && pathname === "/admin/health") return sendHtml(response, renderHealthDashboard());
    if (request.method === "GET" && pathname === "/admin/devices") return sendHtml(response, renderDevicesDebug());
    if (request.method === "GET" && pathname === "/admin/statistics") return sendHtml(response, renderStatistics());
    if (request.method === "GET" && pathname === "/pos") return sendHtml(response, renderPos());
    if (request.method === "GET" && pathname === "/pos/lifecycle") return sendHtml(response, renderLifecycle());
    if (request.method === "GET" && pathname === "/pos/statistics") return sendHtml(response, renderStatistics());
    if (request.method === "GET" && pathname === "/order") return sendHtml(response, renderOrdering());
    if (request.method === "GET" && pathname === "/kitchen") return sendHtml(response, renderKitchen());
    if (request.method === "GET" && pathname === "/debug/devices") return sendHtml(response, renderDevicesDebug());
    if (request.method === "GET" && (pathname === "/mockup/item-workbench" || pathname === "/mockups/back-office-item-workbench.html")) return sendMockup(response, "back-office-item-workbench.html");

    if (request.method === "GET" && pathname === "/api/debug/devices") return success(response, 200, events.listDevices());

    if (request.method === "GET" && pathname === "/api/admin/categories") return success(response, 200, services.catalog.listCategories());
    if (request.method === "POST" && pathname === "/api/admin/categories") return success(response, 201, services.catalog.createCategory(await readJson(request) as never));
    const categoryMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
    if (request.method === "PATCH" && categoryMatch?.[1]) return success(response, 200, services.catalog.updateCategory(decodeURIComponent(categoryMatch[1]), await readJson(request) as never));

    if (request.method === "GET" && pathname === "/api/admin/products") return success(response, 200, services.catalog.listProducts());
    if (request.method === "POST" && pathname === "/api/admin/products") return success(response, 201, services.catalog.createProduct(await readJson(request) as never));
    const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (request.method === "GET" && productMatch?.[1]) return success(response, 200, services.catalog.getProduct(decodeURIComponent(productMatch[1])));
    if (request.method === "PATCH" && productMatch?.[1]) return success(response, 200, services.catalog.updateProduct(decodeURIComponent(productMatch[1]), await readJson(request) as never));
    const publishMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/publish$/);
    if (request.method === "POST" && publishMatch?.[1]) return success(response, 200, services.catalog.publishProduct(decodeURIComponent(publishMatch[1])));

    if (request.method === "GET" && pathname === "/api/catalog/products/published") return success(response, 200, services.catalog.getPublishedProducts(url.searchParams.get("channel") || undefined));
    if (request.method === "GET" && pathname === "/api/events/current") return success(response, 200, services.operations.getCurrentEvent());
    if (request.method === "GET" && pathname === "/api/events/current/products") return success(response, 200, services.operations.getCurrentProducts());
    if (request.method === "POST" && pathname === "/api/orders") {
      const result = services.orders.createPosOrder(await readJson(request));
      events.publish("order.created", result.order.eventId); events.publish("inventory.changed", result.order.eventId);
      return success(response, result.replayed ? 200 : 201, result.order);
    }
    const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderMatch?.[1]) return success(response, 200, services.orders.getOrder(decodeURIComponent(orderMatch[1])));
    const statusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch?.[1]) { const order = services.lifecycle.changeStatus(decodeURIComponent(statusMatch[1]), await readJson(request)); events.publish(order.orderStatus === "completed" ? "order.completed" : "order.production_changed", order.eventId); return success(response, 200, order); }
    const noShowMatch = pathname.match(/^\/api\/orders\/([^/]+)\/no-show$/);
    if (request.method === "POST" && noShowMatch?.[1]) { const order = services.lifecycle.markNoShow(decodeURIComponent(noShowMatch[1]), await readJson(request)); events.publish("order.production_changed", order.eventId); return success(response, 200, order); }
    const releaseMatch = pathname.match(/^\/api\/orders\/([^/]+)\/release-inventory$/);
    if (request.method === "POST" && releaseMatch?.[1]) { const result = services.lifecycle.releaseInventory(decodeURIComponent(releaseMatch[1]), await readJson(request)); events.publish("inventory.changed", result.order.eventId); return success(response, 200, result); }
    const currentOrdersMatch = pathname.match(/^\/api\/events\/([^/]+)\/orders$/);
    if (request.method === "GET" && currentOrdersMatch?.[1]) return success(response, 200, services.lifecycle.listEventOrders(decodeURIComponent(currentOrdersMatch[1])));
    const closeMatch = pathname.match(/^\/api\/events\/([^/]+)\/close$/);
    if (request.method === "POST" && closeMatch?.[1]) { const result = services.lifecycle.closeEvent(decodeURIComponent(closeMatch[1]), await readJson(request)); events.publish("event.closed", decodeURIComponent(closeMatch[1])); return success(response, 200, result); }
    const reportMatch = pathname.match(/^\/api\/events\/([^/]+)\/daily-report$/);
    if (request.method === "GET" && reportMatch?.[1]) return success(response, 200, services.lifecycle.getDailyReport(decodeURIComponent(reportMatch[1])));
    const statisticsMatch = pathname.match(/^\/api\/events\/([^/]+)\/statistics$/);
    if (request.method === "GET" && statisticsMatch?.[1]) return success(response, 200, services.lifecycle.getStatistics(decodeURIComponent(statisticsMatch[1])));
    const closeoutMatch = pathname.match(/^\/api\/events\/([^/]+)\/closeout$/);
    if (request.method === "PUT" && closeoutMatch?.[1]) { const eventId = decodeURIComponent(closeoutMatch[1]); const result = services.lifecycle.saveCloseout(eventId, await readJson(request)); events.publish("closeout.updated", eventId); return success(response, 200, result); }

    if (request.method === "GET" && pathname === "/api/admin/events") return success(response, 200, services.operations.listEvents());
    if (request.method === "POST" && pathname === "/api/admin/events") return success(response, 201, services.operations.createEvent(await readJson(request) as never));
    const eventMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)$/);
    if (request.method === "PATCH" && eventMatch?.[1]) return success(response, 200, services.operations.updateEvent(decodeURIComponent(eventMatch[1]), await readJson(request) as never));
    const eventActionMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)\/(open|close|archive)$/);
    if (request.method === "POST" && eventActionMatch?.[1] && eventActionMatch[2]) {
      const eventId = decodeURIComponent(eventActionMatch[1]);
      const action = eventActionMatch[2];
      if (action === "close") { const result = services.lifecycle.closeEvent(eventId, await readJson(request)); events.publish("event.closed", eventId); return success(response, 200, result); }
      return success(response, 200, action === "open" ? services.operations.openEvent(eventId) : services.operations.archiveEvent(eventId));
    }
    const inventoryMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)\/sellable-inventory$/);
    if (inventoryMatch?.[1] && request.method === "GET") return success(response, 200, services.operations.getInventory(decodeURIComponent(inventoryMatch[1])));
    if (inventoryMatch?.[1] && request.method === "PUT") {
      const input = await readJson(request);
      const productVersionId = typeof input.productVersionId === "string" ? input.productVersionId : "";
      const contract = services.catalog.getPublishedProducts().find((product) => product.productVersionId === productVersionId);
      if (!contract) throw new HttpError(422, "published_product_not_found", "Choose a currently published product version.", { field: "productVersionId" });
      return success(response, 200, services.operations.setSellableInventory(decodeURIComponent(inventoryMatch[1]), contract, input as never));
    }
    if (request.method === "GET" && pathname === "/api/v1") return sendJson(response, 501, { ok: false, error: { code: "not_implemented", message: "Business APIs are intentionally scoped to Catalog Phase 1A." } });
    return sendJson(response, 404, { ok: false, error: { code: "not_found", message: "Route not found." } });
  } catch (error) {
    failure(response, error);
  }
}
