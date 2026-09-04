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
  if (/^\/api\/orders\/[^/]+\/reservation$/.test(pathname) && method === "PATCH") return ["admin", "pos"];
  if (/^\/api\/orders\/[^/]+\/production\/revert-completion$/.test(pathname)) return ["admin", "pos", "kitchen", "closeout"];
  if (/^\/api\/orders\/[^/]+\/(no-show|release-inventory)$/.test(pathname)) return ["admin", "closeout"];
  if (/^\/api\/events\/[^/]+\/(close|daily-report|statistics|closeout)$/.test(pathname)) return ["admin", "closeout"];
  if (/^\/api\/orders(\/[^/]+)?$/.test(pathname) || /^\/api\/orders\/[^/]+\/payment\/confirm$/.test(pathname)) return ["admin", "pos"];
  if (/^\/api\/events\/(current|current\/products|[^/]+\/orders)$/.test(pathname)) return ["admin", "pos", "kitchen", "closeout"];
  return ["admin"];
}
function sameOrigin(request: IncomingMessage, configuredOrigin: string | undefined): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin) return false;
  try {
    if (configuredOrigin) return new URL(origin).origin === configuredOrigin;
    return !!host && new URL(origin).host === host;
  } catch { return false; }
}

export function requireSameOrigin(request: IncomingMessage, configuredOrigin?: string): void {
  if (!sameOrigin(request, configuredOrigin)) {
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
  if (unsafe(request.method)) requireSameOrigin(request, authentication.publicOrigin);
  const permitted = requiredRoles(pathname, request.method);
  if (!permitted.some((role) => principal.roles.includes(role))) throw new HttpError(403, "authorization_forbidden", "Your role is not permitted for this operation.");
  return Object.freeze({ principal });
}

export function sessionToken(request: IncomingMessage): string | undefined { return cookie(request, "ros_session"); }

export type TrustedPrincipalField = "actor" | "operator" | "recordedBy" | "acceptedBy" | "capturedBy";

/**
 * Binds a principal only where the receiving command contract explicitly has
 * a trusted audit-identity field. Routes without such a field retain their
 * strict domain payload unchanged.
 */
export function commandWithPrincipal(
  input: Record<string, unknown>,
  principal: AuthenticatedPrincipal | undefined,
  trustedField?: TrustedPrincipalField
): Record<string, unknown> {
  if (!principal || !trustedField) return input;
  return { ...input, [trustedField]: principal.userId };
}

export function loginRedirect(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname.startsWith("/") ? pathname : "/")}`;
}
