export type SqlParameters = readonly unknown[] | Record<string, unknown>;

export type ExecuteResult = Readonly<{
  changes: number;
  lastInsertRowid?: number | bigint;
}>;

export type DatabaseTransactionPhase = "operation" | "commit";

export class DatabaseTransactionFailure extends Error {
  readonly name = "DatabaseTransactionFailure";

  constructor(
    readonly phase: DatabaseTransactionPhase,
    readonly primaryCause: unknown,
    readonly rollbackFailure: unknown | null,
    readonly adapterUnsafe: boolean
  ) {
    super(
      `Database transaction ${phase} failed${rollbackFailure === null ? "" : " and rollback also failed"}.`,
      { cause: primaryCause }
    );
  }
}

export class DatabaseAdapterUnsafe extends Error {
  readonly name = "DatabaseAdapterUnsafe";

  constructor() {
    super("Database adapter is unsafe for reuse after an unclean transaction failure.");
  }
}

export interface DatabaseAdapter {
  readonly transactionSafety?: "safe" | "unsafe";
  execute(sql: string, parameters?: SqlParameters): ExecuteResult;
  queryOne<T>(sql: string, parameters?: SqlParameters): T | undefined;
  queryMany<T>(sql: string, parameters?: SqlParameters): T[];
  transaction<T>(work: () => T): T;
  transactionImmediate<T>(work: () => T): T;
  close(): void;
}
