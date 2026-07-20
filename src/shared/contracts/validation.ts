export type UnknownRecord = Record<string, unknown>;

export function requireRecord(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as UnknownRecord;
}

export function requireExactKeys(record: UnknownRecord, allowedKeys: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) throw new TypeError(`${label} contains unsupported field: ${key}.`);
  }
}

export function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}

export function requireNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return value as number;
}

export function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new TypeError(`${label} must be a positive integer.`);
  return value as number;
}

export function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
  return value;
}

export function requireIsoTimestamp(value: unknown, label: string): string {
  const timestamp = requireNonEmptyString(value, label);
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError(`${label} must be an ISO-8601 timestamp.`);
  return timestamp;
}

export function optionalNonEmptyString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return requireNonEmptyString(value, label);
}

export function optionalNonNegativeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  return requireNonNegativeInteger(value, label);
}
