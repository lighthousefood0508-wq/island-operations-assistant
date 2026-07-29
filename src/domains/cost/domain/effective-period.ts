import { InvalidEffectivePeriod } from "./errors.js";

export function assertIsoInstant(value: string, field = "Instant"): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new InvalidEffectivePeriod(`${field} must be a canonical ISO-8601 UTC instant.`);
  }
  return value;
}

export class EffectivePeriod {
  private constructor(
    readonly effectiveFrom: string,
    readonly effectiveTo: string | undefined
  ) {
    Object.freeze(this);
  }

  static create(effectiveFrom: string, effectiveTo?: string): EffectivePeriod {
    const from = assertIsoInstant(effectiveFrom, "effectiveFrom");
    const to = effectiveTo === undefined ? undefined : assertIsoInstant(effectiveTo, "effectiveTo");
    if (to !== undefined && to <= from) {
      throw new InvalidEffectivePeriod("effectiveTo must be later than effectiveFrom.");
    }
    return new EffectivePeriod(from, to);
  }

  contains(instant: string): boolean {
    const candidate = assertIsoInstant(instant);
    return this.effectiveFrom <= candidate
      && (this.effectiveTo === undefined || candidate < this.effectiveTo);
  }

  equals(other: EffectivePeriod): boolean {
    return this.effectiveFrom === other.effectiveFrom && this.effectiveTo === other.effectiveTo;
  }
}
