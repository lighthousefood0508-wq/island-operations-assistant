import type {
  DatabaseAdapter
} from "../../../shared/database/database-adapter.js";
import type {
  CostEvaluationQuoteReader,
  CostEvaluationReadUnitOfWork
} from "../domain/cost-evaluation-read-unit-of-work.js";
import { SqliteCostRepository } from "./sqlite-cost-repository.js";

export class SqliteCostEvaluationReadUnitOfWork
implements CostEvaluationReadUnitOfWork {
  constructor(private readonly database: DatabaseAdapter) {}

  execute<T>(work: (reader: CostEvaluationQuoteReader) => T): T {
    return this.database.transaction(() => {
      const repository = new SqliteCostRepository(this.database);
      const reader: CostEvaluationQuoteReader = Object.freeze({
        findEffectiveQuoteAt: repository.findEffectiveQuoteAt.bind(repository)
      });
      return work(reader);
    });
  }
}
