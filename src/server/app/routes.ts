import type { IncomingMessage, ServerResponse } from "node:http";
import { openSseStream, writeHeartbeat } from "../events/sse.js";
import { renderAdmin } from "../../web/admin/page.js";
import { renderKitchen } from "../../web/kitchen/page.js";
import { renderOrdering } from "../../web/ordering/page.js";
import { renderPos } from "../../web/pos/page.js";

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

export function route(request: IncomingMessage, response: ServerResponse): void {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  if (request.method === "GET" && pathname === "/health") {
    sendJson(response, 200, { status: "ok", service: "desert-island-ros", database: "ready", now: new Date().toISOString() });
    return;
  }
  if (request.method === "GET" && pathname === "/events") {
    openSseStream(response);
    const interval = setInterval(() => writeHeartbeat(response), 15_000);
    request.on("close", () => clearInterval(interval));
    return;
  }
  if (request.method === "GET" && pathname === "/admin") return sendHtml(response, renderAdmin());
  if (request.method === "GET" && pathname === "/pos") return sendHtml(response, renderPos());
  if (request.method === "GET" && pathname === "/order") return sendHtml(response, renderOrdering());
  if (request.method === "GET" && pathname === "/kitchen") return sendHtml(response, renderKitchen());
  if (request.method === "GET" && pathname === "/api/v1") {
    sendJson(response, 501, { error: { code: "not_implemented", message: "Business APIs are intentionally not implemented in foundation scope." } });
    return;
  }
  sendJson(response, 404, { error: { code: "not_found", message: "Route not found." } });
}
