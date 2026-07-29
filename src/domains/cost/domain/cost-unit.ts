import { InvalidCostUnit } from "./errors.js";

const UNIT_CODE_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export class CostUnit {
  private constructor(readonly code: string) {
    Object.freeze(this);
  }

  static create(code: string): CostUnit {
    const canonical = code.trim().toLowerCase();
    if (!UNIT_CODE_PATTERN.test(canonical)) {
      throw new InvalidCostUnit();
    }
    return new CostUnit(canonical);
  }

  equals(other: CostUnit): boolean {
    return this.code === other.code;
  }
}
