import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { AuthenticatedPrincipal, AuthenticationCredential, AuthenticationRepository } from "../domain/authentication-repository.js";

type UserRow = { user_id: string; login: string; display_name: string; status: string; password_algorithm: string | null; password_salt: string | null; password_hash: string | null };
type PrincipalRow = { user_id: string; login: string; display_name: string; expires_at: string };

function roles(database: DatabaseAdapter, userId: string): readonly string[] {
  return Object.freeze(database.queryMany<{ code: string }>("SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.role_id WHERE ur.user_id = ? ORDER BY r.code", [userId]).map((row) => row.code));
}
function credential(database: DatabaseAdapter, row: UserRow | undefined): AuthenticationCredential | undefined {
  return row && Object.freeze({ userId: row.user_id, login: row.login, displayName: row.display_name, status: row.status, passwordAlgorithm: row.password_algorithm, passwordSalt: row.password_salt, passwordHash: row.password_hash, roles: roles(database, row.user_id) });
}

export class SqliteAuthenticationRepository implements AuthenticationRepository {
  constructor(private readonly database: DatabaseAdapter) {}

  findCredentialByLogin(login: string): AuthenticationCredential | undefined {
    return credential(this.database, this.database.queryOne<UserRow>("SELECT user_id, login, display_name, status, password_algorithm, password_salt, password_hash FROM users WHERE login = ?", [login]));
  }

  findPrincipalByTokenHash(tokenHash: string, now: string): AuthenticatedPrincipal | undefined {
    const row = this.database.queryOne<PrincipalRow>(`SELECT u.user_id, u.login, u.display_name, s.expires_at
      FROM system_auth_sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`, [tokenHash, now]);
    return row && Object.freeze({ userId: row.user_id, login: row.login, displayName: row.display_name, roles: roles(this.database, row.user_id), expiresAt: row.expires_at });
  }

  hasCredentialedUser(): boolean {
    return this.database.queryOne<{ user_id: string }>("SELECT user_id FROM users WHERE status = 'active' AND password_algorithm IS NOT NULL AND password_salt IS NOT NULL AND password_hash IS NOT NULL LIMIT 1") !== undefined;
  }

  createBootstrapAdministrator(input: Parameters<AuthenticationRepository["createBootstrapAdministrator"]>[0]): void {
    this.database.transactionImmediate(() => {
      this.database.execute("INSERT INTO users (user_id, login, display_name, status, created_at, password_algorithm, password_salt, password_hash, password_changed_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)", [input.userId, input.login, input.displayName, input.createdAt, input.passwordAlgorithm, input.passwordSalt, input.passwordHash, input.createdAt]);
      const admin = this.database.queryOne<{ role_id: string }>("SELECT role_id FROM roles WHERE code = 'admin'");
      if (!admin) throw new Error("Administrator role is unavailable.");
      this.database.execute("INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, ?)", [input.userId, admin.role_id, input.createdAt]);
    });
  }

  createSession(input: Parameters<AuthenticationRepository["createSession"]>[0]): void {
    this.database.execute("INSERT INTO system_auth_sessions (session_id, token_hash, user_id, issued_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)", [input.sessionId, input.tokenHash, input.userId, input.issuedAt, input.expiresAt]);
  }

  revokeSession(tokenHash: string, revokedAt: string): void {
    this.database.execute("UPDATE system_auth_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE token_hash = ?", [revokedAt, tokenHash]);
  }

  createLocalUser(input: Parameters<AuthenticationRepository["createLocalUser"]>[0]): void {
    this.database.transactionImmediate(() => { this.database.execute("INSERT INTO users (user_id, login, display_name, status, created_at, password_algorithm, password_salt, password_hash, password_changed_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)", [input.userId, input.login, input.displayName, input.createdAt, input.passwordAlgorithm, input.passwordSalt, input.passwordHash, input.createdAt]); const role = this.database.queryOne<{ role_id: string }>("SELECT role_id FROM roles WHERE code = ?", [input.role]); if (!role) throw new Error("Local role is unavailable."); this.database.execute("INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES (?, ?, ?)", [input.userId, role.role_id, input.createdAt]); });
  }
  rotatePasswordAndRevokeSessions(input: Parameters<AuthenticationRepository["rotatePasswordAndRevokeSessions"]>[0]): number {
    return this.database.transactionImmediate(() => { const update = this.database.execute("UPDATE users SET password_algorithm = ?, password_salt = ?, password_hash = ?, password_changed_at = ? WHERE user_id = ?", [input.passwordAlgorithm, input.passwordSalt, input.passwordHash, input.changedAt, input.userId]); if (update.changes !== 1) throw new Error("Local identity disappeared."); return this.database.execute("UPDATE system_auth_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ? AND revoked_at IS NULL", [input.changedAt, input.userId]).changes; });
  }
  setLocalUserStatus(input: Parameters<AuthenticationRepository["setLocalUserStatus"]>[0]): number {
    return this.database.transactionImmediate(() => { const update = this.database.execute("UPDATE users SET status = ? WHERE user_id = ?", [input.status, input.userId]); if (update.changes !== 1) throw new Error("Local identity disappeared."); return input.status === "disabled" ? this.database.execute("UPDATE system_auth_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ? AND revoked_at IS NULL", [input.changedAt, input.userId]).changes : 0; });
  }
}
