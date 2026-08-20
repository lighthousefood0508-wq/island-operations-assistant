import {
  CANONICAL_INGREDIENT_CONTRACT_VERSION,
  type CanonicalIngredientArchiveFactV1,
  type CanonicalIngredientContractV1,
  type CanonicalIngredientLifecycleEventV1,
  type CanonicalIngredientRenameFactV1,
  type CanonicalIngredientStatusV1
} from "../contracts/canonical-ingredient-contract.js";
import {
  InvalidCanonicalIngredientAuditEvidence,
  InvalidCanonicalIngredientName,
  InvalidCanonicalIngredientTransition
} from "./errors.js";
import { CanonicalIngredientId } from "./identities.js";
import { IngredientCategory } from "./ingredient-category.js";

type AuditInput = Readonly<{ occurredAt: string; actorId: string; reason: string }>;

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidCanonicalIngredientAuditEvidence(field);
  return normalized;
}

function instant(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new InvalidCanonicalIngredientAuditEvidence(field);
  }
  return value;
}

function name(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidCanonicalIngredientName();
  return normalized;
}

function freezeEvent(event: CanonicalIngredientLifecycleEventV1): CanonicalIngredientLifecycleEventV1 {
  return Object.freeze({ ...event });
}

export class CanonicalIngredient {
  private constructor(
    readonly ingredientId: CanonicalIngredientId,
    readonly name: string,
    readonly category: IngredientCategory,
    readonly status: CanonicalIngredientStatusV1,
    readonly aggregateVersion: number,
    readonly createdAt: string,
    readonly createdBy: string,
    readonly lifecycleHistory: readonly CanonicalIngredientLifecycleEventV1[]
  ) { Object.freeze(this); }

  static create(input: { ingredientId: CanonicalIngredientId; name: string; category: IngredientCategory; createdAt: string; createdBy: string }): CanonicalIngredient {
    return new CanonicalIngredient(input.ingredientId, name(input.name), input.category, "Active", 0,
      instant(input.createdAt, "createdAt"), text(input.createdBy, "createdBy"), Object.freeze([]));
  }

  static replay(input: { ingredientId: CanonicalIngredientId; name: string; category: IngredientCategory; createdAt: string; createdBy: string; lifecycleHistory: readonly CanonicalIngredientLifecycleEventV1[] }): CanonicalIngredient {
    let aggregate = CanonicalIngredient.create(input);
    for (const event of input.lifecycleHistory) {
      if (event.aggregateVersion !== aggregate.aggregateVersion + 1) {
        throw new InvalidCanonicalIngredientAuditEvidence("lifecycle aggregateVersion ordering");
      }
      if (event.eventType === "RENAMED") {
        if (event.previousName !== aggregate.name || event.newName === undefined) throw new InvalidCanonicalIngredientAuditEvidence("rename lifecycle evidence");
        aggregate = aggregate.rename(event.newName, { occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
      } else if (event.eventType === "ARCHIVED") {
        aggregate = aggregate.archive({ occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
      } else {
        aggregate = aggregate.reactivate({ occurredAt: event.occurredAt, actorId: event.actor, reason: event.reason });
      }
    }
    return aggregate;
  }

  get renameHistory(): readonly CanonicalIngredientRenameFactV1[] {
    return Object.freeze(this.lifecycleHistory.filter((event) => event.eventType === "RENAMED").map((event) => Object.freeze({
      previousName: event.previousName!, newName: event.newName!, renamedAt: event.occurredAt, renamedBy: event.actor, reason: event.reason
    })));
  }

  get archiveFact(): CanonicalIngredientArchiveFactV1 | undefined {
    if (this.status !== "Archived") return undefined;
    const event = [...this.lifecycleHistory].reverse().find((candidate) => candidate.eventType === "ARCHIVED");
    return event === undefined ? undefined : Object.freeze({ archivedAt: event.occurredAt, archivedBy: event.actor, reason: event.reason });
  }

  rename(newName: string, audit: AuditInput): CanonicalIngredient {
    if (this.status !== "Active") throw new InvalidCanonicalIngredientTransition(this.status, "RENAME");
    const next = name(newName);
    if (next === this.name) throw new InvalidCanonicalIngredientName("Canonical Ingredient rename must change the authoritative name.");
    return this.transition("RENAMED", audit, { previousName: this.name, newName: next }, next, "Active");
  }

  archive(audit: AuditInput): CanonicalIngredient {
    if (this.status !== "Active") throw new InvalidCanonicalIngredientTransition(this.status, "ARCHIVE");
    return this.transition("ARCHIVED", audit, {}, this.name, "Archived");
  }

  reactivate(audit: AuditInput): CanonicalIngredient {
    if (this.status !== "Archived") throw new InvalidCanonicalIngredientTransition(this.status, "REACTIVATE");
    return this.transition("REACTIVATED", audit, {}, this.name, "Active");
  }

  toContract(): CanonicalIngredientContractV1 {
    return Object.freeze({
      contractVersion: CANONICAL_INGREDIENT_CONTRACT_VERSION,
      ingredientId: this.ingredientId.value, name: this.name, categoryCode: this.category.code,
      status: this.status, aggregateVersion: this.aggregateVersion, createdAt: this.createdAt, createdBy: this.createdBy,
      renameHistory: this.renameHistory,
      ...(this.archiveFact === undefined ? {} : { archiveFact: this.archiveFact })
    });
  }

  private transition(eventType: CanonicalIngredientLifecycleEventV1["eventType"], audit: AuditInput, names: Pick<CanonicalIngredientLifecycleEventV1, "previousName" | "newName">, nextName: string, nextStatus: CanonicalIngredientStatusV1): CanonicalIngredient {
    const occurredAt = instant(audit.occurredAt, "occurredAt");
    if (Date.parse(occurredAt) < Date.parse(this.latestAuditInstant())) throw new InvalidCanonicalIngredientAuditEvidence("lifecycle occurredAt ordering");
    const event = freezeEvent({ aggregateVersion: this.aggregateVersion + 1, eventType, occurredAt, actor: text(audit.actorId, "actor"), reason: text(audit.reason, "reason"), ...names });
    return new CanonicalIngredient(this.ingredientId, nextName, this.category, nextStatus, event.aggregateVersion,
      this.createdAt, this.createdBy, Object.freeze([...this.lifecycleHistory, event]));
  }

  private latestAuditInstant(): string { return this.lifecycleHistory.at(-1)?.occurredAt ?? this.createdAt; }
}
