import type { IncomingMessage, ServerResponse } from "node:http";
import { CatalogService } from "../../domains/catalog/index.js";
import { OperationsService, OrderService } from "../../domains/operations/index.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { openSseStream, writeHeartbeat } from "../events/sse.js";
import { renderAdmin } from "../../web/admin/page.js";
import { renderEventsAdmin } from "../../web/events/page.js";
import { renderKitchen } from "../../web/kitchen/page.js";
import { renderOrdering } from "../../web/ordering/page.js";
import { renderPos } from "../../web/pos/page.js";

type Services = Readonly<{ catalog: CatalogService; operations: OperationsService; orders: OrderService }>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
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

export function createRoute(services: Services): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => { void route(request, response, services); };
}

async function route(request: IncomingMessage, response: ServerResponse, services: Services): Promise<void> {
  const url = new URL(request.url || "/", "http://localhost");
  const { pathname } = url;
  try {
    if (request.method === "GET" && pathname === "/health") return success(response, 200, { status: "ok", service: "desert-island-ros", database: "ready", now: new Date().toISOString() });
    if (request.method === "GET" && pathname === "/events") {
      openSseStream(response);
      const interval = setInterval(() => writeHeartbeat(response), 15_000);
      request.on("close", () => clearInterval(interval));
      return;
    }
    if (request.method === "GET" && pathname === "/admin") return sendHtml(response, renderAdmin());
    if (request.method === "GET" && pathname === "/admin/events") return sendHtml(response, renderEventsAdmin());
    if (request.method === "GET" && pathname === "/pos") return sendHtml(response, renderPos());
    if (request.method === "GET" && pathname === "/order") return sendHtml(response, renderOrdering());
    if (request.method === "GET" && pathname === "/kitchen") return sendHtml(response, renderKitchen());

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
      return success(response, result.replayed ? 200 : 201, result.order);
    }
    const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderMatch?.[1]) return success(response, 200, services.orders.getOrder(decodeURIComponent(orderMatch[1])));

    if (request.method === "GET" && pathname === "/api/admin/events") return success(response, 200, services.operations.listEvents());
    if (request.method === "POST" && pathname === "/api/admin/events") return success(response, 201, services.operations.createEvent(await readJson(request) as never));
    const eventMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)$/);
    if (request.method === "PATCH" && eventMatch?.[1]) return success(response, 200, services.operations.updateEvent(decodeURIComponent(eventMatch[1]), await readJson(request) as never));
    const eventActionMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)\/(open|close|archive)$/);
    if (request.method === "POST" && eventActionMatch?.[1] && eventActionMatch[2]) {
      const eventId = decodeURIComponent(eventActionMatch[1]);
      const action = eventActionMatch[2];
      return success(response, 200, action === "open" ? services.operations.openEvent(eventId) : action === "close" ? services.operations.closeEvent(eventId) : services.operations.archiveEvent(eventId));
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
