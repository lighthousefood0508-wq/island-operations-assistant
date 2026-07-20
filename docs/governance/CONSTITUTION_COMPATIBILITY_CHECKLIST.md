# Constitution Compatibility Checklist

Use this checklist as the fixed first section of every future Implementation Spec before any design or code work begins.

## Reviewed ADR

- List every Accepted ADR relevant to the requested scope.
- State whether the requested behavior changes an ADR, implements an ADR, or is outside the ADR's concern.
- Identify any unresolved policy question that the spec would otherwise decide implicitly.

## Compatibility Result

- `Compatible`: the planned implementation preserves every listed Accepted ADR.
- `Requires Architecture Owner Decision`: a planned change conflicts with, extends, or leaves ambiguous an Accepted ADR. Stop before implementation.

## Required Evidence Before Completion

- State-model and migration evidence where persisted records are affected.
- API and UI evidence when an existing operator workflow changes.
- Architecture guard and verification results.
- The approval record that authorizes the exact compatible scope.
