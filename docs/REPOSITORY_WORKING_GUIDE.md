# Repository Working Guide v1

This guide defines the default working discipline for ROS repository changes. It does not create business authority and cannot override a higher authority.

## 1. Authority hierarchy

When rules conflict, apply them in this order:

1. `CONSTITUTION.md`
2. Approved Architecture Owner Decisions in `docs/DECISIONS.md`
3. Accepted ADRs
4. Domain-owned Ports and versioned Contracts
5. This Repository Working Guide
6. The approved instructions for the individual PR
7. Implementation convenience

Code style, existing shortcuts, SQLite convenience, UI state, and runtime behavior never override Domain or governance authority.

## 2. Governance before implementation

Explicit Architecture Owner authorization is required before implementing any of the following:

- a new Domain or Aggregate
- a new lifecycle or lifecycle transition
- persistence authority or a new migration
- a cross-domain dependency or Contract
- a Domain Event or Snapshot
- financial or allocation authority
- a destructive or historical-data operation
- runtime ownership, external integration, or a new background process

Governance authorization must be committed separately when the approved implementation depends on it. A roadmap, completion report, finding, or future-work note is not implementation approval.

## 3. One PR, one responsibility

Each PR must have one reviewable responsibility and one explicit owner. Do not mix unrelated:

- business behavior
- UI or API changes
- runtime wiring
- migration cleanup
- formatting
- governance synchronization
- work from another Domain

Do not pull findings, recommendations, or future work into the current PR unless the Architecture Owner explicitly expands its scope.

### Current Owner Goal and audit-finding triage

Every authorized task must retain an explicit Current Owner Goal.

A gap, risk, recommendation, or future-work item discovered during an
audit does not automatically become the current task's next step.

A discovered item is a direct blocker only when the Current Owner Goal
cannot be completed, safely verified, or accepted without resolving it.
Even a direct blocker does not expand scope automatically; it must be
reported and receive the required Owner authorization before work begins.

Items that do not directly block the Current Owner Goal must be recorded
as deferred findings. They must not be promoted into the current task,
scheduled as the next PR, or used to trigger implementation without a
separate Owner Decision.

After an authorized direct blocker is resolved, work must return to the
original Current Owner Goal unless the Owner explicitly replaces that goal.

Completion of a Proposal, audit, review, or planning document does not
authorize implementation.

Every proposed next PR must state its direct relationship to the Current
Owner Goal and explain why it is necessary now. If that relationship
cannot be demonstrated, the proposal remains deferred.

## 4. Exact allowlist

Before editing:

- list every file the PR may add or modify
- prefer exact file paths over directory-level permission
- stop if a required file is outside the allowlist
- audit the final diff against the allowlist
- request Owner direction instead of expanding scope

Forbidden staging shortcuts:

- `git add .`
- `git add -A`
- `git add -u`
- wildcard or directory staging
- `git commit -a`

Safe commits use explicit file paths only.

## 5. Preserve the existing worktree

Assume unrelated modified and untracked files belong to other work.

Do not:

- reset, restore, clean, stash, rebase, or amend
- overwrite unrelated files
- discard another person's changes
- include unrelated work in the current commit

If an approved file already contains mixed work that cannot be safely separated, stop and report the conflict.

## 6. Domain authority

The owning Domain defines:

- business rules and invariants
- identity and Value Objects
- lifecycle transitions
- Domain errors
- Repository Ports
- Domain Event contracts

Infrastructure implements Ports. A database row, API payload, UI model, JSON shape, or framework object is never the Domain authority.

## 7. Dependency direction

The default dependency direction is:

```text
Infrastructure
    -> Application / Domain-owned Port
        -> Domain
```

The Domain must not import SQLite, migrations, HTTP, UI, runtime code, or Infrastructure adapters. Cross-domain access is limited to approved identities, versioned Contracts, and Ports. Direct table reads and internal imports across Domains are prohibited.

## 8. History and append-first rules

Historical business evidence is append-first unless an approved Decision explicitly states otherwise.

Do not:

- hard-delete accepted historical evidence
- use mutable `is_current` as the sole authority
- overwrite an old row with a replacement fact
- hide corrections
- let UI state rewrite historical truth

Historical evidence should preserve, as applicable:

- original facts
- effective time and recorded time
- actor identity
- immutable identity
- version
- revision, supersession, or causation evidence

## 9. Exact numeric policy

Authoritative financial and measurement values must follow `docs/05_EXACT_NUMERIC_POLICY.md`.

Do not use:

- SQLite `REAL` as authority
- JavaScript floating-point values as authority
- `parseFloat`
- unsafe `Number(bigint)` conversion
- implicit rounding or division
- implicit unit conversion

Preserve coefficient, scale, currency, unit, and any explicit rounding-policy evidence. Hydration must pass through Domain validation and fail closed on malformed persisted data.

## 10. Time policy

Keep these concepts distinct:

- effective time
- recorded time
- published time
- superseded time
- event occurrence time
- processing time

Business timestamps come from the approved caller or an approved Clock Port. Do not substitute `recordedAt` for `effectiveFrom`, use local time as canonical persistence, or invent timestamps in the database.

Canonical persistence is ISO-8601 UTC text. Effective periods use:

```text
[start, end)
```

Start is inclusive, end is exclusive, and an absent end is open-ended.

## 11. Transaction and concurrency policy

Every multi-write business use case must declare one transaction boundary and review:

- atomicity and rollback
- lost updates and stale writers
- duplicate identity
- double execution and retry behavior
- multiple-connection concurrency
- idempotency and version conflicts

`last write wins` is prohibited for Aggregate mutation. Use an approved aggregate version, expected version, conditional write, and formal conflict error. Business code depends on a Domain-owned transaction or Unit-of-Work Port, never directly on a database driver.

## 12. Error policy

Distinguish:

- Domain validation failure
- illegal lifecycle transition
- identity conflict
- version conflict
- ambiguity
- not found
- persistence technical failure
- external integration failure

Do not replace these with a single generic error, swallow errors, return silent success, pick an arbitrary winner for ambiguity, or expose unclassified database exceptions as business errors. Stable error codes are required where the failure crosses a boundary.

## 13. Migration policy

A migration must:

- use the next approved immutable identifier
- run transactionally where the repository mechanism permits
- define required constraints and justified indexes
- work on both a fresh database and the supported upgrade path
- avoid guessing or backfilling business facts without approval
- avoid redefining legacy data as new authority
- avoid unrelated schema changes or sample business data

Run migration smoke verification for every migration PR. Never edit an already committed migration.

## 14. Test policy

Every PR must test the applicable categories.

### Happy path

- valid creation
- valid transition
- valid query or projection

### Boundaries

- minimum and maximum values
- inclusive and exclusive instants
- open-ended periods
- exact numeric boundaries
- nullable evidence

### Invalid state

- illegal lifecycle
- wrong version or identity
- invalid numeric evidence
- malformed persistence row

### Concurrency and persistence

- stale writer
- double execution
- multiple repository connections
- retry at the current version
- round-trip and duplicate identity
- migration and rollback
- technical failure mapping

### Regression

- strict TypeScript typecheck
- relevant Domain and persistence suites
- Architecture Guard
- migration smoke when applicable

Tests must assert business outcomes, not merely execute lines.

## 15. No hidden authority

Do not silently create authority through:

- `ORDER BY ... LIMIT 1` to conceal ambiguity
- insertion-order, recorded-time, version, or identity winners
- a UI-selected value treated as Domain truth
- database defaults for business timestamps
- repository-generated business evidence
- silent normalization
- fallback currency, unit, supplier, or actor

If the business result is ambiguous, return the approved ambiguity result or error.

## 16. Architecture Gate v1

Every implementation PR must complete this gate before Safe Commit.

### A. Scope and governance

- approval record and allowlist
- authorized and deferred scope
- scope deviations
- unauthorized or hidden behavior

### B. Architecture

- dependency direction and Domain authority
- Port ownership and Aggregate boundary
- circular dependency and cross-module coupling
- God object, duplicate service, and Infrastructure leakage

### C. Business rules

- invariants and lifecycle transitions
- impossible states and ambiguity
- history, identity, time, retry, and idempotency

### D. Persistence

- schema constraints and exact numeric storage
- hydration validation
- transaction and concurrency behavior
- duplicate identity, migration safety, rollback, indexes, and query authority

### E. Security and data integrity

- actor evidence and audit completeness
- sensitive-data, secret, and unsafe-logging exposure
- SQL/path injection and error leakage
- unauthorized mutation authority

### F. Performance

- full scans, missing indexes, and N+1 queries
- unlimited history loading or memory growth
- transaction duration, lock contention, payload size, and unbounded retry

Classify each concern as current blocker, acceptable v1 tradeoff, or future optimization. Performance must not silently change Domain authority.

### G. Maintainability

- duplicated SQL or mapping
- magic strings and numbers
- long methods or classes
- naming and null ambiguity
- premature abstraction
- missing explanation for non-obvious invariants

### H. Tests

- happy path, boundary, and invalid state
- concurrency and persistence failure
- migration, regression, and Architecture Guard
- missing cases and false-positive tests

### I. Cross-module impact

Classify impact on Recipe, Cost, Supplier, Purchase, Inventory, Operations, POS, KDS, Kitchen, Voice, Reporting, Snapshot, API, UI, and AI Copilot as:

- No Impact
- Compatible
- Potential Risk
- Breaking Change
- Not Yet Applicable

### J. Future compatibility

Check whether the slice blocks later Supplier identity, Purchase Order, Inventory lots, Unit Conversion, multi-currency, Recipe costing, historical snapshots, batch cost, reporting, API/UI, multi-device, or offline synchronization. Do not implement those future capabilities speculatively.

### K. Self challenge

Produce:

```text
Top 10 Reasons to Reject This PR
```

Classify each as real blocker, resolved by the current implementation, accepted tradeoff, future risk, or not applicable.

### L. Refactor opportunities

Produce:

```text
Top Future Refactor Opportunities
```

Classify each as now, next phase, after repeated duplication, long-term only, or do not abstract.

### M. Final gate decision

Choose exactly one:

- PASS
- PASS WITH DOCUMENTED RISKS
- BLOCKED

A BLOCKED PR must not be staged, committed, or followed by the next PR until the Owner resolves the blocker.

## 17. Safe Commit policy

Safe Commit begins only after:

1. implementation is complete
2. required tests and Architecture Gate pass
3. Architecture Owner approves merge

The Safe Commit sequence is:

1. verify HEAD and staged area
2. verify the exact allowlist
3. stage exact file paths
4. audit the cached diff
5. rerun required tests
6. commit with the approved message
7. audit the commit and remaining worktree

Do not amend, push, or start the next PR.

## 18. Reporting format

Completion reports include:

- baseline and approval record
- allowlist and implemented behavior
- architecture and business-rule verification
- persistence and concurrency behavior
- exact test counts
- Git diff and staged state
- remaining unrelated worktree changes
- scope deviations and findings
- final status

Do not report only “tests passed”; state which suites ran and their passed/total counts.
