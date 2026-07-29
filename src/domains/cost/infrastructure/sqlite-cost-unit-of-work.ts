import type { DatabaseAdapter } from "../../../shared/database/database-adapter.js";
import type { CostQuoteUnitOfWork } from "../domain/cost-unit-of-work.js";
import { CostDomainError } from "../domain/errors.js";
import { CostPersistenceError, CostPersistenceFailure } from "../persistence/errors.js";
import { SqliteCostRepository } from "./sqlite-cost-repository.js";

export class SqliteCostQuoteUnitOfWork implements CostQuoteUnitOfWork {
  private readonly repository: SqliteCostRepository;

  constructor(private readonly database: DatabaseAdapter) {
    this.repository = new SqliteCostRepository(database);
  }

  execute<T>(work: (repository: SqliteCostRepository) => T): T {
    try {
      return this.database.transactionImmediate(() => work(this.repository));
    } catch (error) {
      if (error instanceof CostDomainError || error instanceof CostPersistenceError) {
        throw error;
      }
      throw new CostPersistenceFailure("execute Cost Quote lifecycle transaction", error);
    }
  }
}
