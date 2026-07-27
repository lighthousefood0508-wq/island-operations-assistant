-- Add command metadata to the existing payment ledger without rewriting
-- historical rows. NULL values identify records created before this command.

ALTER TABLE operations_payments ADD COLUMN idempotency_key TEXT;
ALTER TABLE operations_payments ADD COLUMN request_fingerprint TEXT;
ALTER TABLE operations_payments ADD COLUMN operator TEXT;
ALTER TABLE operations_payments ADD COLUMN device_id TEXT;
ALTER TABLE operations_payments ADD COLUMN identity_trust TEXT;
ALTER TABLE operations_payments ADD COLUMN audit_log_id TEXT REFERENCES audit_logs(audit_log_id);

CREATE UNIQUE INDEX IF NOT EXISTS operations_payments_idempotency_unique
  ON operations_payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_payments_order_status
  ON operations_payments(order_id, payment_status);
