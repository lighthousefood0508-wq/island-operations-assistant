import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CatalogService } from "../../domains/catalog/index.js";
import { LifecycleService, OperationsService, OrderService, PaymentService } from "../../domains/operations/index.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  CanonicalIngredientReferenceImpactNotFound,
  CanonicalIngredientReferenceImpactReadFailure,
  CanonicalIngredientReferenceImpactService,
  CanonicalIngredientReferenceImpactValidationFailure,
  type CanonicalIngredientReferenceImpactV1
} from "../../application/canonical-ingredient-reference-impact-service.js";
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
import { renderCostBackOffice } from "../../web/cost/page.js";
import { renderCanonicalIngredientManagement } from "../../web/ingredients/page.js";
import type {
  CanonicalIngredientManagementService
} from "./canonical-ingredient-management-service.js";
import type { CostBackOfficeService } from "./cost-back-office-service.js";

type Services = Readonly<{
  catalog: CatalogService;
  operations: OperationsService;
  orders: OrderService;
  payments: PaymentService;
  lifecycle: LifecycleService;
  canonicalIngredients: CanonicalIngredientManagementService;
  canonicalIngredientReferenceImpact: CanonicalIngredientReferenceImpactService;
  costBackOffice: CostBackOfficeService;
}>;

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

async function readJsonValue(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100_000) throw new HttpError(413, "payload_too_large", "Request body is too large.");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object.");
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const value = await readJsonValue(request);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function telemetryPart(value: string | null, fallback: string): string {
  return /^[A-Za-z0-9-]{1,32}$/.test(value || "") ? value as string : fallback;
}

function readReferenceImpact(
  service: CanonicalIngredientReferenceImpactService,
  encodedIngredientId: string
): CanonicalIngredientReferenceImpactV1 {
  let ingredientId: string;
  try {
    ingredientId = decodeURIComponent(encodedIngredientId);
  } catch {
    throw new HttpError(
      422,
      "CANONICAL_INGREDIENT_REFERENCE_IMPACT_VALIDATION_FAILURE",
      "Canonical Ingredient Reference Impact identity is invalid."
    );
  }
  try {
    return service.getByIngredientId(ingredientId);
  } catch (error) {
    if (error instanceof CanonicalIngredientReferenceImpactValidationFailure) {
      throw new HttpError(422, error.code, error.message);
    }
    if (error instanceof CanonicalIngredientReferenceImpactNotFound) {
      throw new HttpError(404, error.code, error.message);
    }
    if (error instanceof CanonicalIngredientReferenceImpactReadFailure) {
      throw new HttpError(500, error.code, error.message);
    }
    throw new HttpError(
      500,
      "internal_error",
      "An unexpected server error occurred."
    );
  }
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
    if (request.method === "GET" && pathname === "/admin/ingredients") return sendHtml(response, renderCanonicalIngredientManagement());
    if (request.method === "GET" && pathname === "/admin/cost") return sendHtml(response, renderCostBackOffice());
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

    if (
      request.method === "GET"
      && pathname === "/api/admin/canonical-ingredients"
    ) {
      return success(
        response,
        200,
        services.canonicalIngredients.list(
          url.searchParams.get("lifecycle") ?? undefined
        )
      );
    }
    const canonicalIngredientDetailMatch = pathname.match(
      /^\/api\/admin\/canonical-ingredients\/([^/]+)$/
    );
    if (request.method === "GET" && canonicalIngredientDetailMatch?.[1]) {
      return success(
        response,
        200,
        services.canonicalIngredients.getById(
          canonicalIngredientDetailMatch[1]
        )
      );
    }
    const canonicalIngredientReferenceImpactMatch = pathname.match(
      /^\/api\/admin\/canonical-ingredients\/([^/]+)\/reference-impact$/
    );
    if (
      request.method === "GET"
      && canonicalIngredientReferenceImpactMatch?.[1]
    ) {
      return success(
        response,
        200,
        readReferenceImpact(
          services.canonicalIngredientReferenceImpact,
          canonicalIngredientReferenceImpactMatch[1]
        )
      );
    }
    const canonicalIngredientRenameMatch = pathname.match(
      /^\/api\/admin\/canonical-ingredients\/([^/]+)\/rename$/
    );
    if (request.method === "POST" && canonicalIngredientRenameMatch?.[1]) {
      return success(
        response,
        200,
        services.canonicalIngredients.rename(
          canonicalIngredientRenameMatch[1],
          await readJsonValue(request)
        )
      );
    }
    const canonicalIngredientArchiveMatch = pathname.match(
      /^\/api\/admin\/canonical-ingredients\/([^/]+)\/archive$/
    );
    if (request.method === "POST" && canonicalIngredientArchiveMatch?.[1]) {
      return success(
        response,
        200,
        services.canonicalIngredients.archive(
          canonicalIngredientArchiveMatch[1],
          await readJsonValue(request)
        )
      );
    }
    const canonicalIngredientReactivateMatch = pathname.match(
      /^\/api\/admin\/canonical-ingredients\/([^/]+)\/reactivate$/
    );
    if (request.method === "POST" && canonicalIngredientReactivateMatch?.[1]) {
      return success(
        response,
        200,
        services.canonicalIngredients.reactivate(
          canonicalIngredientReactivateMatch[1],
          await readJsonValue(request)
        )
      );
    }

    if (request.method === "GET" && pathname === "/api/admin/cost/setup") {
      return success(response, 200, services.costBackOffice.getSetup());
    }
    if (request.method === "POST" && pathname === "/api/admin/cost/ingredients") {
      return success(
        response,
        201,
        services.costBackOffice.createIngredient(await readJson(request))
      );
    }
    if (request.method === "POST" && pathname === "/api/admin/cost/profiles") {
      return success(
        response,
        201,
        services.costBackOffice.createProfile(await readJson(request))
      );
    }
    const profileSupersessionMatch = pathname.match(
      /^\/api\/admin\/cost\/profiles\/([^/]+)\/supersessions$/
    );
    if (request.method === "POST" && profileSupersessionMatch?.[1]) {
      return success(
        response,
        201,
        services.costBackOffice.supersedeProfile(
          decodeURIComponent(profileSupersessionMatch[1]),
          await readJson(request)
        )
      );
    }
    const profileDeprecationMatch = pathname.match(
      /^\/api\/admin\/cost\/profiles\/([^/]+)\/deprecations$/
    );
    if (request.method === "POST" && profileDeprecationMatch?.[1]) {
      return success(
        response,
        200,
        services.costBackOffice.deprecateProfile(
          decodeURIComponent(profileDeprecationMatch[1]),
          await readJson(request)
        )
      );
    }
    const profileDraftAppendMatch = pathname.match(/^\/api\/admin\/cost\/profiles\/([^/]+)\/re-establishment-drafts$/);
    if (request.method === "POST" && profileDraftAppendMatch?.[1]) {
      return success(response, 201, services.costBackOffice.appendProfileReestablishmentDraft(decodeURIComponent(profileDraftAppendMatch[1]), await readJson(request)));
    }
    const profileDraftMatch = pathname.match(/^\/api\/admin\/cost\/profiles\/([^/]+)\/drafts\/([^/]+)$/);
    if (request.method === "PATCH" && profileDraftMatch?.[1] && profileDraftMatch[2]) {
      return success(response, 200, services.costBackOffice.reviseProfileReestablishmentDraft(decodeURIComponent(profileDraftMatch[1]), decodeURIComponent(profileDraftMatch[2]), await readJson(request)));
    }
    const profileDraftActivationMatch = pathname.match(/^\/api\/admin\/cost\/profiles\/([^/]+)\/drafts\/([^/]+)\/activations$/);
    if (request.method === "POST" && profileDraftActivationMatch?.[1] && profileDraftActivationMatch[2]) {
      return success(response, 200, services.costBackOffice.activateProfileReestablishmentDraft(decodeURIComponent(profileDraftActivationMatch[1]), decodeURIComponent(profileDraftActivationMatch[2]), await readJson(request)));
    }
    if (request.method === "POST" && pathname === "/api/admin/cost/recipes") {
      return success(
        response,
        201,
        services.costBackOffice.createAndPublishRecipe(
          await readJson(request)
        )
      );
    }
    if (request.method === "POST" && pathname === "/api/admin/cost/quotes") {
      return success(
        response,
        201,
        services.costBackOffice.recordQuote(await readJson(request))
      );
    }
    const quoteReplacementMatch = pathname.match(
      /^\/api\/admin\/cost\/quotes\/([^/]+)\/replacements$/
    );
    if (request.method === "POST" && quoteReplacementMatch?.[1]) {
      return success(
        response,
        201,
        services.costBackOffice.replaceQuote(
          decodeURIComponent(quoteReplacementMatch[1]),
          await readJson(request)
        )
      );
    }
    if (request.method === "GET" && pathname === "/api/admin/cost/quotes") {
      const ingredientId = url.searchParams.get("ingredientId");
      if (!ingredientId) {
        throw new HttpError(
          400,
          "ingredient_id_required",
          "ingredientId is required."
        );
      }
      return success(
        response,
        200,
        services.costBackOffice.listQuotes(ingredientId)
      );
    }
    if (
      request.method === "POST"
      && pathname === "/api/admin/cost/evaluations"
    ) {
      return success(
        response,
        200,
        services.costBackOffice.evaluate(await readJson(request))
      );
    }

    if (request.method === "GET" && pathname === "/api/admin/categories") return success(response, 200, services.catalog.listCategories());
    if (request.method === "POST" && pathname === "/api/admin/categories") return success(response, 201, services.catalog.createCategory(await readJson(request) as never));
    const categoryMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
    if (request.method === "PATCH" && categoryMatch?.[1]) return success(response, 200, services.catalog.updateCategory(decodeURIComponent(categoryMatch[1]), await readJson(request) as never));

    if (request.method === "GET" && pathname === "/api/admin/products") return success(response, 200, services.catalog.listProducts());
    if (request.method === "POST" && pathname === "/api/admin/products") return success(response, 201, services.catalog.createProduct(await readJson(request) as never));
    const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (request.method === "GET" && productMatch?.[1]) return success(response, 200, services.catalog.getProduct(decodeURIComponent(productMatch[1])));
    if (request.method === "PATCH" && productMatch?.[1]) return success(response, 200, services.catalog.updateProduct(decodeURIComponent(productMatch[1]), await readJson(request) as never));
    if (request.method === "DELETE" && productMatch?.[1]) return success(response, 200, services.catalog.deleteProduct(decodeURIComponent(productMatch[1])));
    const publishMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)\/publish$/);
    if (request.method === "POST" && publishMatch?.[1]) return success(response, 200, services.catalog.publishProduct(decodeURIComponent(publishMatch[1])));

    if (request.method === "GET" && pathname === "/api/catalog/products/published") return success(response, 200, services.catalog.getPublishedProducts(url.searchParams.get("channel") || undefined));
    if (request.method === "GET" && pathname === "/api/events/current") return success(response, 200, services.operations.getCurrentEvent());
    if (request.method === "GET" && pathname === "/api/events/current/products") return success(response, 200, services.operations.getCurrentProducts());
    if (request.method === "POST" && pathname === "/api/orders") {
      const result = services.orders.createPosOrder(await readJson(request));
      events.publish("order.created", result.order.eventId); events.publish("inventory.changed", result.order.eventId);
      if (!result.replayed && result.order.paymentStatus === "paid") events.publish("payment.confirmed", result.order.eventId);
      return success(response, result.replayed ? 200 : 201, result.order);
    }
    const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (request.method === "GET" && orderMatch?.[1]) return success(response, 200, services.orders.getOrder(decodeURIComponent(orderMatch[1])));
    const paymentConfirmMatch = pathname.match(/^\/api\/orders\/([^/]+)\/payment\/confirm$/);
    if (request.method === "POST" && paymentConfirmMatch?.[1]) {
      const result = services.payments.confirmPayment(decodeURIComponent(paymentConfirmMatch[1]), await readJson(request));
      if (!result.replayed) {
        events.publish("payment.confirmed", result.order.eventId);
        events.publish("order.completed", result.order.eventId);
      }
      return success(response, 200, result);
    }
    const statusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch?.[1]) { const order = services.lifecycle.changeStatus(decodeURIComponent(statusMatch[1]), await readJson(request)); events.publish(order.orderStatus === "completed" ? "order.completed" : "order.production_changed", order.eventId); return success(response, 200, order); }
    const revertProductionMatch = pathname.match(/^\/api\/orders\/([^/]+)\/production\/revert-completion$/);
    if (request.method === "POST" && revertProductionMatch?.[1]) { const order = services.lifecycle.revertProductionCompletion(decodeURIComponent(revertProductionMatch[1]), await readJson(request)); events.publish("order.production_changed", order.eventId); return success(response, 200, order); }
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
    const eventActionMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)\/(open|pause|resume|close|archive)$/);
    if (request.method === "POST" && eventActionMatch?.[1] && eventActionMatch[2]) {
      const eventId = decodeURIComponent(eventActionMatch[1]);
      const action = eventActionMatch[2];
      if (action === "close") { const result = services.lifecycle.closeEvent(eventId, await readJson(request)); events.publish("event.closed", eventId); return success(response, 200, result); }
      const event = action === "open" ? services.operations.openEvent(eventId)
        : action === "pause" ? services.operations.pauseEvent(eventId)
          : action === "resume" ? services.operations.resumeEvent(eventId)
            : services.operations.archiveEvent(eventId);
      events.publish(action === "pause" ? "event.paused" : action === "resume" ? "event.resumed" : "event.opened", eventId);
      return success(response, 200, event);
    }
    const inventoryMatch = pathname.match(/^\/api\/admin\/events\/([^/]+)\/sellable-inventory$/);
    if (inventoryMatch?.[1] && request.method === "GET") return success(response, 200, services.operations.getInventory(decodeURIComponent(inventoryMatch[1])));
    if (inventoryMatch?.[1] && request.method === "PUT") {
      const input = await readJson(request);
      const eventId = decodeURIComponent(inventoryMatch[1]);
      if (Array.isArray(input.items)) {
        const contracts = new Map(services.catalog.getPublishedProducts().map((product) => [product.productVersionId, product]));
        const result = services.operations.saveInventoryBatch(eventId, contracts, input as never);
        events.publish("inventory.changed", eventId);
        return success(response, 200, result);
      }
      const productVersionId = typeof input.productVersionId === "string" ? input.productVersionId : "";
      const contract = services.catalog.getPublishedProducts().find((product) => product.productVersionId === productVersionId);
      if (!contract) throw new HttpError(422, "published_product_not_found", "Choose a currently published product version.", { field: "productVersionId" });
      return success(response, 200, services.operations.setSellableInventory(eventId, contract, input as never));
    }
    if (request.method === "GET" && pathname === "/api/v1") return sendJson(response, 501, { ok: false, error: { code: "not_implemented", message: "Business APIs are intentionally scoped to Catalog Phase 1A." } });
    return sendJson(response, 404, { ok: false, error: { code: "not_found", message: "Route not found." } });
  } catch (error) {
    failure(response, error);
  }
}
