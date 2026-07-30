# Exact Numeric Policy v1

Status: Approved Measurement Foundation v1 policy under DECISIONS #053 and #056.

This policy records only the exact numeric constraints already implemented and approved for Measurement Foundation v1. It creates no schema, migration, rounding behavior, or Cost arithmetic authority.

## Authoritative representation

- JavaScript floating-point values and SQLite `REAL` must not be Measurement quantity, ratio, conversion, or normalization authority.
- An exact decimal quantity uses a canonical base-10 coefficient and an integer scale.
- Coefficients and exact-arithmetic results must remain within the signed 64-bit integer range.
- Measurement Foundation v1 supports scale 0 through 6.
- Measurement quantities used by the current normalization contract are positive.
- Canonical decimal evidence removes trailing zeroes without changing value.

## Exact ratios

- A conversion ratio uses a positive integer numerator and positive integer denominator.
- Numerator and denominator must remain within the signed 64-bit integer range.
- Ratios are reduced by their greatest common divisor.
- A zero or negative denominator is invalid.
- Conversion identity and conversion version are preserved with the exact numerator and denominator.

## No-rounding policy

- Measurement Foundation v1 performs no silent rounding.
- Recipe and Cost cannot select, inject, or override Measurement rounding behavior.
- A result that cannot be represented exactly within supported scale fails closed.
- Arithmetic overflow and unsupported scale fail closed.
- A displayed or formatted number is never authoritative calculation input.

## Historical evidence

Formal normalization evidence preserves:

- raw coefficient and scale;
- raw stable unit code;
- dimension;
- conversion identity and version;
- exact numerator and denominator;
- normalized coefficient and scale; and
- canonical unit code.

Historical evidence retains the exact conversion facts originally used. A later conversion or Profile revision must not silently recalculate or overwrite it.

## Deferred

This policy does not define presentation rounding, financial settlement rounding, allocation residuals, package conversion, density conversion, measured or estimated conversion, yield, waste, or persistence schema. Each requires separate Owner approval.
