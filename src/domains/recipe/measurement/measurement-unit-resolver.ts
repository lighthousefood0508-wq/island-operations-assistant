import type {
  MeasurementUnitResolutionContractV1,
  MeasurementUnitResolutionRequestV1,
  MeasurementUnitResolutionResultV1,
  StableMeasurementUnitCodeV1
} from "../contracts/measurement-foundation-contract.js";
import {
  InvalidMeasurementUnitResolution,
  UnknownMeasurementUnit
} from "./errors.js";
import { resolveMeasurementUnit } from "./unit-catalog.js";

const GLOBAL_ALIASES = new Map<string, readonly StableMeasurementUnitCodeV1[]>([
  ["公克", Object.freeze(["g"])],
  ["克", Object.freeze(["g"])],
  ["公斤", Object.freeze(["kg"])],
  ["毫升", Object.freeze(["ml"])],
  ["公升", Object.freeze(["l"])],
  ["打", Object.freeze(["dozen"])]
]);

const LOCALE_ALIASES = new Map<string, ReadonlyMap<string, readonly StableMeasurementUnitCodeV1[]>>([
  ["zh-TW", new Map([["斤", Object.freeze(["tw_catty"])]])]
]);

const LOCALE_SENSITIVE_ALIASES = new Set(["斤"]);
const UNSUPPORTED_TAIWAN_UNITS = new Set(["兩"]);
const PACKAGE_IDENTITIES = new Set(["包", "袋", "盒", "罐"]);

function freezeCandidates(
  candidates: readonly StableMeasurementUnitCodeV1[]
): readonly StableMeasurementUnitCodeV1[] {
  return Object.freeze([...candidates]);
}

function resolved(
  rawValue: string,
  unitCode: StableMeasurementUnitCodeV1,
  scope: "EXPLICIT" | "GLOBAL" | "LOCALE",
  locale?: string
): MeasurementUnitResolutionResultV1 {
  const definition = resolveMeasurementUnit(unitCode);
  return Object.freeze({
    status: "resolved",
    scope,
    rawValue,
    ...(locale === undefined ? {} : { locale }),
    unitCode,
    dimension: definition.dimension,
    canonicalUnitCode: definition.canonicalUnitCode
  });
}

function resolveCandidates(
  rawValue: string,
  candidates: readonly StableMeasurementUnitCodeV1[],
  scope: "GLOBAL" | "LOCALE",
  locale?: string
): MeasurementUnitResolutionResultV1 {
  if (candidates.length === 1) {
    return resolved(rawValue, candidates[0]!, scope, locale);
  }
  return Object.freeze({
    status: "ambiguous",
    rawValue,
    candidates: freezeCandidates(candidates)
  });
}

export class MeasurementUnitResolver implements MeasurementUnitResolutionContractV1 {
  resolveUnit(
    request: MeasurementUnitResolutionRequestV1
  ): MeasurementUnitResolutionResultV1 {
    if (typeof request.rawValue !== "string" || request.rawValue.trim() === "") {
      throw new InvalidMeasurementUnitResolution("Measurement unit text is required.");
    }
    if (
      request.locale !== undefined
      && (typeof request.locale !== "string" || request.locale.trim() === "")
    ) {
      throw new InvalidMeasurementUnitResolution(
        "Measurement locale must be a non-empty string when provided."
      );
    }

    const rawValue = request.rawValue;
    const lookupValue = rawValue.trim();
    const locale = request.locale?.trim();

    try {
      const definition = resolveMeasurementUnit(lookupValue);
      return resolved(
        rawValue,
        definition.code,
        "EXPLICIT"
      );
    } catch (error) {
      if (!(error instanceof UnknownMeasurementUnit)) {
        throw error;
      }
    }

    const globalCandidates = GLOBAL_ALIASES.get(lookupValue);
    if (globalCandidates !== undefined) {
      return resolveCandidates(rawValue, globalCandidates, "GLOBAL");
    }

    if (PACKAGE_IDENTITIES.has(lookupValue)) {
      return Object.freeze({ status: "package_specification_required", rawValue });
    }
    if (UNSUPPORTED_TAIWAN_UNITS.has(lookupValue)) {
      return Object.freeze({ status: "unsupported_taiwan_unit", rawValue });
    }
    if (LOCALE_SENSITIVE_ALIASES.has(lookupValue) && locale === undefined) {
      return Object.freeze({ status: "locale_required", rawValue });
    }

    if (locale !== undefined) {
      const localeCandidates = LOCALE_ALIASES.get(locale)?.get(lookupValue);
      if (localeCandidates !== undefined) {
        return resolveCandidates(rawValue, localeCandidates, "LOCALE", locale);
      }
      if (LOCALE_SENSITIVE_ALIASES.has(lookupValue)) {
        return Object.freeze({
          status: "unsupported_locale_alias",
          rawValue,
          locale
        });
      }
    }

    return Object.freeze({ status: "unknown", rawValue });
  }
}
