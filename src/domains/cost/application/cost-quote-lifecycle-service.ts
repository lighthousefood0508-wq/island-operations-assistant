import type { CostRepository } from "../domain/cost-repository.js";
import type { CostQuoteUnitOfWork } from "../domain/cost-unit-of-work.js";
import type { CostSource } from "../domain/cost-source.js";
import type { CostUnit } from "../domain/cost-unit.js";
import type { EffectivePeriod } from "../domain/effective-period.js";
import {
  AmbiguousEffectiveIngredientCostQuote,
  IngredientCostQuoteAlreadySuperseded,
  InvalidIngredientCostQuote
} from "../domain/errors.js";
import type { ExactDecimal } from "../domain/exact-decimal.js";
import { IngredientCostQuote } from "../domain/ingredient-cost-quote.js";
import type { IngredientCostQuoteId, IngredientId } from "../domain/identities.js";
import type { MonetaryAmount } from "../domain/monetary-amount.js";
import {
  IngredientCostQuoteEffectivePeriodOverlap,
  IngredientCostQuoteIdentityConflict,
  IngredientCostQuoteIngredientMismatch,
  IngredientCostQuoteLifecycleNotFound,
  IngredientCostQuoteRetryConflict,
  InvalidIngredientCostQuoteReplacement
} from "./errors.js";

type NewIngredientCostQuoteEvidence = Readonly<{
  quoteId: IngredientCostQuoteId;
  ingredientId: IngredientId;
  monetaryAmount: MonetaryAmount;
  purchaseQuantity: ExactDecimal;
  purchaseUnit: CostUnit;
  effectivePeriod: EffectivePeriod;
  source: CostSource;
  recordedAt: string;
  recordedBy: string;
}>;

export type RecordInitialIngredientCostQuoteCommand = NewIngredientCostQuoteEvidence;

export type ReplaceEffectiveIngredientCostQuoteCommand = Readonly<{
  oldQuoteId: IngredientCostQuoteId;
  expectedVersion: number;
  newQuote: NewIngredientCostQuoteEvidence;
  supersededAt: string;
  supersededBy: string;
}>;

export type RecordInitialIngredientCostQuoteResult = Readonly<{
  status: "recorded" | "already_applied";
  quoteId: IngredientCostQuoteId;
  aggregateVersion: number;
}>;

export type ReplaceEffectiveIngredientCostQuoteResult = Readonly<{
  status: "replaced" | "already_applied";
  oldQuoteId: IngredientCostQuoteId;
  newQuoteId: IngredientCostQuoteId;
  oldAggregateVersion: number;
  newAggregateVersion: number;
}>;

type AuthorityInterval = Readonly<{
  quoteId: string;
  start: string;
  end: string | undefined;
}>;

function sameRecordedFacts(left: IngredientCostQuote, right: IngredientCostQuote): boolean {
  return left.quoteId.equals(right.quoteId)
    && left.ingredientId.equals(right.ingredientId)
    && left.monetaryAmount.equals(right.monetaryAmount)
    && left.purchaseQuantity.equals(right.purchaseQuantity)
    && left.purchaseUnit.equals(right.purchaseUnit)
    && left.effectivePeriod.equals(right.effectivePeriod)
    && left.source.equals(right.source)
    && left.recordedAt === right.recordedAt
    && left.recordedBy === right.recordedBy;
}

function createLifecycleOwnedQuote(input: NewIngredientCostQuoteEvidence): IngredientCostQuote {
  if (Object.prototype.hasOwnProperty.call(input, "aggregateVersion")) {
    throw new InvalidIngredientCostQuote(
      "New Ingredient Cost Quote aggregateVersion is lifecycle-owned."
    );
  }
  return IngredientCostQuote.record({
    ...input,
    aggregateVersion: 0
  });
}

function authorityInterval(quote: IngredientCostQuote): AuthorityInterval | undefined {
  const periodEnd = quote.effectivePeriod.effectiveTo;
  const supersededAt = quote.supersession?.supersededAt;
  const end = periodEnd === undefined
    ? supersededAt
    : supersededAt === undefined || periodEnd <= supersededAt
      ? periodEnd
      : supersededAt;
  if (end !== undefined && end <= quote.effectivePeriod.effectiveFrom) {
    return undefined;
  }
  return Object.freeze({
    quoteId: quote.quoteId.value,
    start: quote.effectivePeriod.effectiveFrom,
    end
  });
}

function intervalsOverlap(left: AuthorityInterval, right: AuthorityInterval): boolean {
  const leftStartsBeforeRightEnds = right.end === undefined || left.start < right.end;
  const rightStartsBeforeLeftEnds = left.end === undefined || right.start < left.end;
  return leftStartsBeforeRightEnds && rightStartsBeforeLeftEnds;
}

function assertHistoryUnambiguous(quotes: readonly IngredientCostQuote[]): void {
  const intervals = quotes
    .map(authorityInterval)
    .filter((interval): interval is AuthorityInterval => interval !== undefined);
  for (let leftIndex = 0; leftIndex < intervals.length; leftIndex += 1) {
    const left = intervals[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < intervals.length; rightIndex += 1) {
      const right = intervals[rightIndex]!;
      if (intervalsOverlap(left, right)) {
        throw new AmbiguousEffectiveIngredientCostQuote([left.quoteId, right.quoteId]);
      }
    }
  }
}

function assertCandidateDoesNotOverlap(
  candidate: IngredientCostQuote,
  history: readonly IngredientCostQuote[],
  ignoredQuoteId?: IngredientCostQuoteId
): void {
  const candidateInterval = authorityInterval(candidate)!;
  const conflicts = history
    .filter((quote) => ignoredQuoteId === undefined || !quote.quoteId.equals(ignoredQuoteId))
    .filter((quote) => {
      const interval = authorityInterval(quote);
      return interval !== undefined && intervalsOverlap(candidateInterval, interval);
    })
    .map((quote) => quote.quoteId.value);
  if (conflicts.length > 0) {
    throw new IngredientCostQuoteEffectivePeriodOverlap([
      candidate.quoteId.value,
      ...conflicts
    ]);
  }
}

function recordedResult(
  status: RecordInitialIngredientCostQuoteResult["status"],
  quote: IngredientCostQuote
): RecordInitialIngredientCostQuoteResult {
  return Object.freeze({
    status,
    quoteId: quote.quoteId,
    aggregateVersion: quote.aggregateVersion
  });
}

function replacementResult(
  status: ReplaceEffectiveIngredientCostQuoteResult["status"],
  oldQuote: IngredientCostQuote,
  newQuote: IngredientCostQuote
): ReplaceEffectiveIngredientCostQuoteResult {
  return Object.freeze({
    status,
    oldQuoteId: oldQuote.quoteId,
    newQuoteId: newQuote.quoteId,
    oldAggregateVersion: oldQuote.aggregateVersion,
    newAggregateVersion: newQuote.aggregateVersion
  });
}

export class CostQuoteLifecycleService {
  constructor(private readonly unitOfWork: CostQuoteUnitOfWork) {}

  recordInitialQuote(
    command: RecordInitialIngredientCostQuoteCommand
  ): RecordInitialIngredientCostQuoteResult {
    const candidate = createLifecycleOwnedQuote(command);
    return this.unitOfWork.execute((repository) => {
      const existing = repository.findByQuoteId(candidate.quoteId);
      if (existing !== undefined) {
        if (sameRecordedFacts(existing, candidate)) {
          return recordedResult("already_applied", existing);
        }
        throw new IngredientCostQuoteIdentityConflict(candidate.quoteId.value);
      }

      const history = repository.findQuotesByIngredientId(candidate.ingredientId);
      assertHistoryUnambiguous(history);
      assertCandidateDoesNotOverlap(candidate, history);
      repository.save(candidate);
      return recordedResult("recorded", candidate);
    });
  }

  replaceEffectiveQuote(
    command: ReplaceEffectiveIngredientCostQuoteCommand
  ): ReplaceEffectiveIngredientCostQuoteResult {
    const candidate = createLifecycleOwnedQuote(command.newQuote);
    return this.unitOfWork.execute((repository) => {
      const oldQuote = repository.findByQuoteId(command.oldQuoteId);
      if (oldQuote === undefined) {
        throw new IngredientCostQuoteLifecycleNotFound(command.oldQuoteId.value);
      }

      const existingCandidate = repository.findByQuoteId(candidate.quoteId);
      if (oldQuote.state === "Superseded") {
        return this.resolveCompletedReplacementRetry(
          oldQuote,
          existingCandidate,
          candidate,
          command
        );
      }
      if (existingCandidate !== undefined) {
        throw new IngredientCostQuoteIdentityConflict(candidate.quoteId.value);
      }

      oldQuote.assertExpectedVersion(command.expectedVersion);
      this.validateReplacement(oldQuote, candidate, command);

      const history = repository.findQuotesByIngredientId(oldQuote.ingredientId);
      assertHistoryUnambiguous(history);
      assertCandidateDoesNotOverlap(candidate, history, oldQuote.quoteId);

      oldQuote.supersedeWith(candidate, {
        supersededAt: command.supersededAt,
        supersededBy: command.supersededBy
      });
      repository.save(candidate);
      repository.saveWithExpectedVersion(oldQuote, command.expectedVersion);
      return replacementResult("replaced", oldQuote, candidate);
    });
  }

  private validateReplacement(
    oldQuote: IngredientCostQuote,
    candidate: IngredientCostQuote,
    command: ReplaceEffectiveIngredientCostQuoteCommand
  ): void {
    if (oldQuote.quoteId.equals(candidate.quoteId)) {
      throw new IngredientCostQuoteIdentityConflict(candidate.quoteId.value);
    }
    if (!oldQuote.ingredientId.equals(candidate.ingredientId)) {
      throw new IngredientCostQuoteIngredientMismatch(
        oldQuote.quoteId.value,
        candidate.quoteId.value
      );
    }
    if (candidate.effectivePeriod.effectiveFrom !== command.supersededAt) {
      throw new InvalidIngredientCostQuoteReplacement(
        "Replacement effectiveFrom must equal supersededAt."
      );
    }
    if (!oldQuote.effectivePeriod.contains(command.supersededAt)) {
      throw new InvalidIngredientCostQuoteReplacement(
        "The replaced Quote must be authoritative at the replacement cutover."
      );
    }
  }

  private resolveCompletedReplacementRetry(
    oldQuote: IngredientCostQuote,
    existingCandidate: IngredientCostQuote | undefined,
    candidate: IngredientCostQuote,
    command: ReplaceEffectiveIngredientCostQuoteCommand
  ): ReplaceEffectiveIngredientCostQuoteResult {
    const supersession = oldQuote.supersession!;
    if (!supersession.supersededByQuoteId.equals(candidate.quoteId)) {
      throw new IngredientCostQuoteAlreadySuperseded(oldQuote.quoteId.value);
    }
    const exactSupersession = supersession.supersededAt === command.supersededAt
      && supersession.supersededBy === command.supersededBy;
    const exactVersions = oldQuote.aggregateVersion === command.expectedVersion + 1
      && candidate.aggregateVersion === 0
      && existingCandidate?.aggregateVersion === 0
      && existingCandidate.state === "Recorded";
    if (
      exactSupersession
      && exactVersions
      && existingCandidate !== undefined
      && sameRecordedFacts(existingCandidate, candidate)
    ) {
      return replacementResult("already_applied", oldQuote, existingCandidate);
    }
    throw new IngredientCostQuoteRetryConflict(
      `Ingredient Cost Quote replacement retry for ${oldQuote.quoteId.value} does not match the completed operation.`
    );
  }
}
