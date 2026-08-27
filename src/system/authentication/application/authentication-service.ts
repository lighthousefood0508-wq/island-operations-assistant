import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { RosAuthenticationConfig } from "../../../config/runtime.js";
import type { AuthenticatedPrincipal, AuthenticationCredential, AuthenticationRepository } from "../domain/authentication-repository.js";
import {
  AuthenticationBootstrapFailure,
  AuthenticationInvalidCredentials,
  AuthenticationPersistenceFailure,
  AuthenticationIdentityDuplicate,
  AuthenticationIdentityNotFound,
  AuthenticationRequired,
  AuthenticationValidationFailure
} from "./authentication-errors.js";

const algorithm = "scrypt:N=16384,r=8,p=1,keylen=64";
const keyLength = 64;
const scryptOptions = Object.freeze({ N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

function now(): string { return new Date().toISOString(); }
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function credentialHash(password: string, salt: string): string {
  return scryptSync(password, salt, keyLength, scryptOptions).toString("hex");
}
function validLogin(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9._-]{3,80}$/.test(value); }
function validPassword(value: unknown): value is string { return typeof value === "string" && value.length >= 12 && value.length <= 256; }
function expiry(issuedAt: string, minutes: number): string {
  return new Date(new Date(issuedAt).getTime() + minutes * 60_000).toISOString();
}

export type AuthenticationLoginResult = Readonly<{ principal: AuthenticatedPrincipal; sessionToken: string }>;
export type LocalIdentityRole = "admin" | "pos" | "kitchen" | "closeout";
const localRoles = new Set<LocalIdentityRole>(["admin", "pos", "kitchen", "closeout"]);

/** AuthenticationRoleBoundary: System-only local credentials and opaque session coordination. */
export class AuthenticationService {
  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly configuration: RosAuthenticationConfig = {
      mode: "disabled",
      secureCookie: false,
      sessionTtlMinutes: 720
    }
  ) {}

  get required(): boolean { return this.configuration.mode === "required"; }

  get publicOrigin(): string | undefined { return this.configuration.publicOrigin; }

  ensureBootstrap(): void {
    if (!this.required) return;
    try {
      if (this.repository.hasCredentialedUser()) return;
      const bootstrap = this.configuration.bootstrapAdministrator;
      if (!bootstrap || !validLogin(bootstrap.login) || !validPassword(bootstrap.password)) {
        throw new AuthenticationBootstrapFailure();
      }
      if (this.repository.findCredentialByLogin(bootstrap.login) !== undefined) {
        throw new AuthenticationBootstrapFailure();
      }
      const createdAt = now();
      const salt = randomBytes(16).toString("hex");
      this.repository.createBootstrapAdministrator({
        userId: `user_${randomUUID()}`,
        login: bootstrap.login,
        displayName: bootstrap.displayName || bootstrap.login,
        passwordAlgorithm: algorithm,
        passwordSalt: salt,
        passwordHash: credentialHash(bootstrap.password, salt),
        createdAt
      });
    } catch (error) {
      if (error instanceof AuthenticationBootstrapFailure) throw error;
      throw new AuthenticationPersistenceFailure();
    }
  }

  login(input: unknown): AuthenticationLoginResult {
    if (!this.required) throw new AuthenticationRequired();
    const value = input !== null && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : undefined;
    if (!value || !validLogin(value.login) || !validPassword(value.password)) throw new AuthenticationValidationFailure();
    try {
      const credential = this.repository.findCredentialByLogin(value.login);
      if (!this.validCredential(credential, value.password)) throw new AuthenticationInvalidCredentials();
      const issuedAt = now();
      const sessionToken = randomBytes(32).toString("base64url");
      const expiresAt = expiry(issuedAt, this.configuration.sessionTtlMinutes);
      this.repository.createSession({ sessionId: `session_${randomUUID()}`, tokenHash: tokenHash(sessionToken), userId: credential.userId, issuedAt, expiresAt });
      return Object.freeze({ principal: Object.freeze({ userId: credential.userId, login: credential.login, displayName: credential.displayName, roles: credential.roles, expiresAt }), sessionToken });
    } catch (error) {
      if (error instanceof AuthenticationValidationFailure || error instanceof AuthenticationInvalidCredentials) throw error;
      throw new AuthenticationPersistenceFailure();
    }
  }

  authenticate(sessionToken: string | undefined): AuthenticatedPrincipal {
    if (!this.required) throw new AuthenticationRequired();
    if (!sessionToken || sessionToken.length > 512) throw new AuthenticationRequired();
    try {
      const principal = this.repository.findPrincipalByTokenHash(tokenHash(sessionToken), now());
      if (!principal) throw new AuthenticationRequired();
      return principal;
    } catch (error) {
      if (error instanceof AuthenticationRequired) throw error;
      throw new AuthenticationPersistenceFailure();
    }
  }

  logout(sessionToken: string | undefined): void {
    if (!this.required) return;
    if (!sessionToken) throw new AuthenticationRequired();
    try { this.repository.revokeSession(tokenHash(sessionToken), now()); }
    catch { throw new AuthenticationPersistenceFailure(); }
  }

  createLocalUser(input: Readonly<{ login: unknown; displayName: unknown; role: unknown; password: unknown }>): Readonly<{ login: string; role: LocalIdentityRole }> {
    if (!validLogin(input.login) || typeof input.displayName !== "string" || !input.displayName.trim() || !validPassword(input.password) || typeof input.role !== "string" || !localRoles.has(input.role as LocalIdentityRole)) throw new AuthenticationValidationFailure();
    try {
      if (this.repository.findCredentialByLogin(input.login)) throw new AuthenticationIdentityDuplicate();
      const createdAt = now(); const salt = randomBytes(16).toString("hex"); const role = input.role as LocalIdentityRole;
      this.repository.createLocalUser({ userId: `user_${randomUUID()}`, login: input.login, displayName: input.displayName.trim(), role, passwordAlgorithm: algorithm, passwordSalt: salt, passwordHash: credentialHash(input.password, salt), createdAt });
      return Object.freeze({ login: input.login, role });
    } catch (error) { if (error instanceof AuthenticationValidationFailure || error instanceof AuthenticationIdentityDuplicate) throw error; throw new AuthenticationPersistenceFailure(); }
  }

  rotateLocalPassword(input: Readonly<{ login: unknown; password: unknown }>): Readonly<{ login: string; revokedSessionCount: number }> {
    if (!validLogin(input.login) || !validPassword(input.password)) throw new AuthenticationValidationFailure();
    try {
      const identity = this.repository.findCredentialByLogin(input.login); if (!identity) throw new AuthenticationIdentityNotFound();
      const changedAt = now(); const salt = randomBytes(16).toString("hex");
      const revokedSessionCount = this.repository.rotatePasswordAndRevokeSessions({ userId: identity.userId, passwordAlgorithm: algorithm, passwordSalt: salt, passwordHash: credentialHash(input.password, salt), changedAt });
      return Object.freeze({ login: identity.login, revokedSessionCount });
    } catch (error) { if (error instanceof AuthenticationValidationFailure || error instanceof AuthenticationIdentityNotFound) throw error; throw new AuthenticationPersistenceFailure(); }
  }

  setLocalUserStatus(input: Readonly<{ login: unknown; status: unknown }>): Readonly<{ login: string; status: "active" | "disabled"; revokedSessionCount: number }> {
    if (!validLogin(input.login) || (input.status !== "active" && input.status !== "disabled")) throw new AuthenticationValidationFailure();
    try { const identity = this.repository.findCredentialByLogin(input.login); if (!identity) throw new AuthenticationIdentityNotFound(); const revokedSessionCount = this.repository.setLocalUserStatus({ userId: identity.userId, status: input.status, changedAt: now() }); return Object.freeze({ login: identity.login, status: input.status, revokedSessionCount }); }
    catch (error) { if (error instanceof AuthenticationValidationFailure || error instanceof AuthenticationIdentityNotFound) throw error; throw new AuthenticationPersistenceFailure(); }
  }

  sessionCookie(sessionToken: string): string {
    const secure = this.configuration.secureCookie ? "; Secure" : "";
    return `ros_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${this.configuration.sessionTtlMinutes * 60}${secure}`;
  }

  clearSessionCookie(): string {
    const secure = this.configuration.secureCookie ? "; Secure" : "";
    return `ros_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  }

  private validCredential(credential: AuthenticationCredential | undefined, password: string): credential is AuthenticationCredential {
    if (!credential || credential.status !== "active" || credential.passwordAlgorithm !== algorithm || !credential.passwordSalt || !credential.passwordHash) return false;
    const expected = Buffer.from(credential.passwordHash, "hex");
    const actual = Buffer.from(credentialHash(password, credential.passwordSalt), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
