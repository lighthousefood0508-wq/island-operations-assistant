import type { CostRepository } from "./cost-repository.js";

/**
 * Cost-owned transaction boundary for multi-write Quote lifecycle operations.
 * Infrastructure supplies the transaction mechanics and the scoped Repository.
 */
export interface CostQuoteUnitOfWork {
  execute<T>(work: (repository: CostRepository) => T): T;
}
