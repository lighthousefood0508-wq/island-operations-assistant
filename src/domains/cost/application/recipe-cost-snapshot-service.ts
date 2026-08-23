import { randomUUID } from "node:crypto";
import { CostSnapshot } from "../domain/cost-snapshot.js";
import { InvalidCostSnapshot } from "../domain/errors.js";
import type { CostSnapshotRepository } from "../domain/cost-snapshot-repository.js";
import { CostSnapshotId } from "../domain/identities.js";
import type { RecipeCostEvaluationResultV1 } from "../domain/recipe-cost-evaluation.js";
import { CostPersistenceFailure } from "../persistence/errors.js";
import { RecipeCostSnapshotPersistenceFailure, RecipeCostSnapshotValidationFailure } from "./recipe-cost-snapshot-errors.js";

export class RecipeCostSnapshotService {
  constructor(private readonly snapshots: CostSnapshotRepository) {}
  capture(command: Readonly<{ result: RecipeCostEvaluationResultV1; capturedAt: string; capturedBy: string }>) {
    try { const snapshot=CostSnapshot.capture({costSnapshotId:CostSnapshotId.fromUuid(randomUUID()),result:command.result,capturedAt:command.capturedAt,capturedBy:command.capturedBy}); this.snapshots.saveNew(snapshot); return snapshot.toContract(); } catch(error) { if(error instanceof RecipeCostSnapshotValidationFailure||error instanceof RecipeCostSnapshotPersistenceFailure)throw error; if(error instanceof InvalidCostSnapshot)throw new RecipeCostSnapshotValidationFailure(); throw new RecipeCostSnapshotPersistenceFailure(); }
  }
}
