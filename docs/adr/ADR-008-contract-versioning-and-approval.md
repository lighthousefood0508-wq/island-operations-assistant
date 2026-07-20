# ADR-008: Contract Versioning and Approval

## Decision

Product Contract and Sales Contract carry explicit version values and are frozen under `src/shared/contracts/`. Changes need explicit approval from the Architecture Owner, Miles / 林子茂.

## Rationale

Cross-domain contracts are the highest-risk coupling point. Treating them as ordinary implementation details would move the original synchronization problem into a hidden interface.

## Consequence

Any change requires a new or compatible version, updated contract documentation, validation/tests, and a migration/rollout plan. It is never bundled silently with a feature change.
