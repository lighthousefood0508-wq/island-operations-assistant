import { InvalidRecipeState } from "./errors.js";

export class VersionNumber {
  private constructor(readonly value: number) {
    Object.freeze(this);
  }

  static create(value: number): VersionNumber {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new InvalidRecipeState("Version number must be a positive safe integer.");
    }
    return new VersionNumber(value);
  }

  isAfter(other: VersionNumber): boolean {
    return this.value > other.value;
  }
}
