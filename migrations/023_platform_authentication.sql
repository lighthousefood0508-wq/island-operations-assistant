ALTER TABLE users ADD COLUMN password_algorithm TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;

CREATE TABLE IF NOT EXISTS system_auth_sessions (
  session_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS system_auth_sessions_active_by_token
  ON system_auth_sessions(token_hash, expires_at);

INSERT OR IGNORE INTO roles (role_id, code, name, created_at)
VALUES
  ('role_admin', 'admin', 'Administrator', '2026-08-25T00:00:00.000Z'),
  ('role_pos', 'pos', 'POS Operator', '2026-08-25T00:00:00.000Z'),
  ('role_kitchen', 'kitchen', 'Kitchen Operator', '2026-08-25T00:00:00.000Z'),
  ('role_closeout', 'closeout', 'Closeout Operator', '2026-08-25T00:00:00.000Z');
