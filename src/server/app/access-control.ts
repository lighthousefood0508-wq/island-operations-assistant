import type { IncomingMessage } from "node:http";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  AuthenticationPersistenceFailure,
  AuthenticationRequired,
  type AuthenticatedPrincipal,
  type AuthenticationService
} from "../../system/authentication/index.js";

type Role = "admin" | "pos" | "kitchen" | "closeout";
export type AuthenticatedRequest = Readonly<{ principal: AuthenticatedPrincipal | undefined }>;

function cookie(request: IncomingMessage, key: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  return header.split(";").map((part) => part.trim()).map((part) => part.split("=", 2)).find(([name]) => name === key)?.[1];
}
function unsafe(method: string | undefined): boolean { return !["GET", "HEAD", "OPTIONS"].includes(method ?? "GET"); }
function requiredRoles(pathname: string, method: string | undefined): readonly Role[] {
  if (pathname === "/api/auth/session" || pathname === "/api/auth/logout") return ["admin", "pos", "kitchen", "closeout"];
  if (pathname === "/events") return ["admin", "pos", "kitchen", "closeout"];
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/debug") || pathname.startsWith("/api/debug")) return ["admin"];
  if (pathname === "/pos/lifecycle" || pathname === "/pos/statistics") return ["admin", "closeout"];
  if (pathname === "/pos" || pathname === "/order") return ["admin", "pos"];
  if (pathname === "/kitchen") return ["admin", "kitchen"];
  if (/^\/api\/orders\/[^/]+\/status$/.test(pathname) && method === "PATCH") return ["admin", "pos", "kitchen"];
  if (/^\/api\/orders\/[^/]+\/production\/revert-completion$/.test(pathname)) return ["admin", "pos", "kitchen", "closeout"];
  if (/^\/api\/orders\/[^/]+\/(no-show|release-inventory)$/.test(pathname)) return ["admin", "closeout"];
  if (/^\/api\/events\/[^/]+\/(close|daily-report|statistics|closeout)$/.test(pathname)) return ["admin", "closeout"];
  if (/^\/api\/orders(\/[^/]+)?$/.test(pathname) || /^\/api\/orders\/[^/]+\/payment\/confirm$/.test(pathname)) return ["admin", "pos"];
  if (/^\/api\/events\/(current|current\/products|[^/]+\/orders)$/.test(pathname)) return ["admin", "pos", "kitchen", "closeout"];
  return ["admin"];
}
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export function requireSameOrigin(request: IncomingMessage): void {
  if (!sameOrigin(request)) {
    throw new HttpError(403, "csrf_origin_forbidden", "Request origin is not permitted.");
  }
}

/** AuthenticationRoleBoundary: HTTP-only authentication, role policy, CSRF origin checks, and principal binding. */
export function requireAccess(authentication: AuthenticationService, request: IncomingMessage, pathname: string): AuthenticatedRequest {
  if (!authentication.required) return Object.freeze({ principal: undefined });
  let principal: AuthenticatedPrincipal;
  try { principal = authentication.authenticate(cookie(request, "ros_session")); }
  catch (error) {
    if (error instanceof AuthenticationRequired) throw new HttpError(401, "authentication_required", "Authentication is required.");
    if (error instanceof AuthenticationPersistenceFailure) throw new HttpError(500, "authentication_failed", "Authentication could not be completed.");
    throw error;
  }
  if (unsafe(request.method)) requireSameOrigin(request);
  const permitted = requiredRoles(pathname, request.method);
  if (!permitted.some((role) => principal.roles.includes(role))) throw new HttpError(403, "authorization_forbidden", "Your role is not permitted for this operation.");
  return Object.freeze({ principal });
}

export function sessionToken(request: IncomingMessage): string | undefined { return cookie(request, "ros_session"); }

export function commandWithPrincipal(input: Record<string, unknown>, principal: AuthenticatedPrincipal | undefined): Record<string, unknown> {
  if (!principal) return input;
  const actor = principal.userId;
  return { ...input, actor, operator: actor, recordedBy: actor, createdBy: actor, publishedBy: actor, acceptedBy: actor, capturedBy: actor, archivedBy: actor, renamedBy: actor, supersededBy: actor };
}

export function loginRedirect(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname.startsWith("/") ? pathname : "/")}`;
}
