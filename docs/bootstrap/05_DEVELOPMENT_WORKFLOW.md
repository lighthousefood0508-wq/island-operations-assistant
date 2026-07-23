# Development Workflow

All future work must follow this sequence.

```text
Review
-> Decision
-> Implementation
-> Verification
-> Commit
-> Handover
```

## 1. Review

Before modifying files:

1. Read `CONSTITUTION.md`.
2. Read relevant accepted ADRs and Architecture Owner Decisions.
3. Read `AGENTS.md`.
4. Read the bootstrap documents and current handover.
5. Search for existing related logic.
6. Identify the domain owner.
7. Identify existing API, service, repository, UI, and tests.

Required audit questions:

- Does similar logic already exist?
- Which implementation is the single source?
- Which files are expected to change?
- Does this require schema, contract, API, or business-rule change?
- Does this affect Legacy or external integrations?

## 2. Decision

Implementation requires explicit Architecture Owner approval when scope touches:

- Architecture
- Domain ownership
- Product Contract
- API contract
- Database schema
- Business rules
- Event lifecycle
- Inventory rules
- Payment
- Cost
- Customer
- Preorder
- External integrations

Decision records should include:

- Purpose
- Problem
- Alternatives
- Decision
- Scope
- Deferred items
- Verification
- Compatibility
- Future impact

## 3. Implementation

Implementation must be minimal and scoped.

Rules:

- Modify existing logic before adding new logic.
- Do not create duplicate APIs or duplicate services.
- Do not bypass domain services.
- Do not change tests to hide product defects.
- Do not add source code outside approved scope.
- Do not change data rules from UI code.

## 4. Verification

Run the verification appropriate to the change.

Common verification:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm architecture:guard
pnpm migration:smoke
pnpm test:e2e
pnpm verify
pnpm verify:full
```

If a script name differs, use the repository's `package.json` scripts and report the exact command.

For documentation-only work, tests are not required unless requested.

## 5. Commit

Only commit when the task explicitly allows commits.

Commit rules:

- Keep commits scoped.
- Do not mix unrelated UI, domain, test, and documentation changes.
- Do not merge unless explicitly instructed.
- Do not create tags unless explicitly instructed.

## 6. Handover

Every completion report must include:

- Approval Record
- Branch
- Commit
- Scope
- Modified files
- Verification
- Deferred work
- Working tree status
- Architecture confirmation

The report must be useful for the next AI session without re-discovering the same context.
