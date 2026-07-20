export type SqlParameters = readonly unknown[] | Record<string, unknown>;

export type ExecuteResult = Readonly<{
  changes: number;
  lastInsertRowid?: number | bigint;
}>;

export interface DatabaseAdapter {
  execute(sql: string, parameters?: SqlParameters): ExecuteResult;
  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined;
  queryMany<T>(sql: string, parameters?: SqlParameters): T[];
  transaction<T>(work: () => T): T;
  transactionImmediate<T>(work: () => T): T;
  close(): void;
}
