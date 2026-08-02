# Repository Governance: Prevent Audit-Driven Task Drift

> **PROPOSAL ONLY — NOT A GOVERNANCE AMENDMENT OR IMPLEMENTATION WORK ORDER**

Status: Owner review draft

This one-off Task Card format and path apply only to this governance proposal.
They do not establish a repository-wide Task Card template, directory, or
numbering convention.

## 1. Purpose

Propose one narrowly scoped amendment to `docs/REPOSITORY_WORKING_GUIDE.md`
that prevents audit findings from silently replacing the Architecture Owner's
current goal. This document plans the amendment only. It does not make the
proposed rule effective and does not authorize implementation.

## 2. Current Owner Goal

Current Owner Goal:
Formal Recipe Draft Creation and Publication

## 3. Problem Statement

Repository audits can reveal valid gaps, risks, recommendations, and future
work outside the task being performed. Discovery alone is not authorization,
does not establish priority, and does not prove that the finding is required
for the Current Owner Goal.

Without an explicit triage rule, a non-blocking finding can be promoted into
the current task or the next PR, causing the approved product goal to be
displaced by audit-driven work. Existing one-PR-one-responsibility and Gate
separation rules constrain scope, but they do not explicitly require work to
return to the original Owner Goal after an authorized blocker is resolved.

## 4. Proposed Permanent Rule

The following text is proposed for placement in
`docs/REPOSITORY_WORKING_GUIDE.md` near `One PR, one responsibility`:

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

## 5. Direct Blocker Definition

A finding is a direct blocker only when evidence shows that leaving it
unresolved prevents at least one of the following:

- completion of the Current Owner Goal;
- safe and truthful verification of that goal; or
- Owner acceptance under the currently authorized rules.

Urgency, architectural interest, future value, nearby code, or the existence
of a completed proposal does not by itself make a finding a direct blocker.
Classification as a direct blocker does not authorize work. The blocker must
be reported and must receive the applicable Owner authorization before scope
changes or implementation begin.

## 6. Deferred Finding Handling

Non-blocking findings must be recorded with enough context for later review,
including their observed evidence and why they do not block the Current Owner
Goal. Recording a finding must not:

- promote it into the current task;
- schedule it as the next PR;
- create an implementation branch;
- trigger production, governance, migration, API, UI, or test changes; or
- alter the Current Owner Goal.

A deferred finding remains deferred until a separate Owner Decision gives it
an explicit purpose, baseline, scope, allowlist, verification plan, and Git
authorization.

## 7. Owner Authorization Boundary

Neither audit discovery nor blocker classification expands an existing
allowlist. Any inserted blocker work requires the same explicit Owner gates as
other work. The authorization must identify what may change and which actions
are allowed. The agent must stop and report instead of inferring permission.

## 8. Return-to-Goal Requirement

After an authorized direct blocker is resolved and reviewed, work returns to
the original Current Owner Goal. A blocker may replace the goal only when the
Owner explicitly records a different Current Owner Goal.

## 9. Proposal / Implementation Gate Separation

Completion or approval of a Proposal, audit, review, planning document, or
Task Card does not authorize implementation. Governance amendment,
implementation, verification, commit, push, PR creation, integration, and
release remain separate gates unless an Owner authorization explicitly states
otherwise.

## 10. Next-PR Relationship Requirement

Every proposed next PR must state:

- the Current Owner Goal;
- the exact capability the PR adds;
- the evidence showing why that capability is required now; and
- whether the PR is a direct blocker, direct delivery slice, or deferred work.

If a direct relationship to the Current Owner Goal cannot be demonstrated,
the PR must not be scheduled as the next task and remains deferred.

## 11. Future Implementation Exact Allowlist

This Proposal-only Task Card authorizes only its own creation:

```text
docs/reviews/REPOSITORY_GOVERNANCE_PREVENT_AUDIT_DRIVEN_TASK_DRIFT_TASK_CARD.md
```

If the Owner later issues a separate Governance Work Order, the proposed
implementation allowlist is exactly:

```text
docs/REPOSITORY_WORKING_GUIDE.md
```

`docs/REPOSITORY_POLICY.md` is not included. Completion of this Task Card must
not be interpreted as authorization to modify the Working Guide.

## 12. Out of Scope

- Modifying `docs/REPOSITORY_WORKING_GUIDE.md` or
  `docs/REPOSITORY_POLICY.md`.
- Establishing a permanent Task Card path, template, or numbering convention.
- Modifying Roadmap, Architecture, ADR, Constitution, or historical Owner
  Decision text.
- Implementing Recipe or Canonical Ingredient behavior.
- Starting Ingredient PR-INGREDIENT-003A, 003B, or 003C.
- Modifying Runtime, API, UI, Schema, Migration, Tests, or production code.
- Creating or switching branches, commits, pushes, pull requests, or merges.
- Resolving unrelated governance findings discovered while preparing this
  proposal.

## 13. Acceptance Criteria

The future governance amendment may be accepted only when:

1. It modifies only `docs/REPOSITORY_WORKING_GUIDE.md`.
2. The rule is placed near `One PR, one responsibility`.
3. It explicitly defines a direct blocker.
4. A direct blocker still requires Owner authorization and never expands scope
   automatically.
5. Non-blocking findings can only be recorded as deferred.
6. Proposal completion is explicitly separated from implementation
   authorization.
7. Work returns to the original Current Owner Goal after an authorized blocker
   is resolved.
8. Every proposed next PR must explain its direct relationship to the Current
   Owner Goal.
9. Policy, Roadmap, ADR, Decision history, and production code remain
   unchanged.
10. `git diff --check` and every applicable repository governance-document
    check pass.

## 14. Verification Plan

For the future amendment, verification must include:

1. Inspect the complete diff and prove the exact one-file allowlist.
2. Confirm the new section is adjacent to the one-PR-one-responsibility rule.
3. Search for language that could imply automatic scope expansion or automatic
   implementation authorization and fail the review if found.
4. Confirm Policy, Roadmap, ADR, Decision history, Runtime, API, UI, Schema,
   Migration, and Tests are absent from the diff.
5. Run `git diff --check` and any existing governance lint or link check that
   applies to the Working Guide.
6. Report the remaining Current Owner Goal and the immediate return-to-goal
   action after governance review.

## 15. Recipe Mainline Protection

Current Owner Goal:
Formal Recipe Draft Creation and Publication

After the proposed governance rule is separately authorized, implemented, and
reviewed, the next step must return to the Recipe Draft / Publish Proposal.
Any other governance issue found during this work must be recorded as deferred
unless it directly blocks safe completion and acceptance of this Task Card. It
must not change the mainline without a separate Owner Decision.

## 16. Ingredient Proposal Status

`docs/reviews/PR-INGREDIENT-003_CANONICAL_INGREDIENT_LIFECYCLE_APPLICATION_BOUNDARY_PROPOSAL.md`
remains:

```text
DEFERRED — PROPOSAL COMPLETE, IMPLEMENTATION NOT AUTHORIZED
```

It remains untracked and must not be modified, deleted, committed, or pushed.
Its existing content hash must remain:

```text
1d3180139712b6fcf2cc88fd6c8e0d04023e9925
```
