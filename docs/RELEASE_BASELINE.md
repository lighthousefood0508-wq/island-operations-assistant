# ROS Architecture Development Baseline

Last verified: 2026-08-11 (Asia/Taipei)

Governance basis: DECISIONS #055, #058, #059, #064, #065, #066,
#069, and #070.

Despite this historical filename, this document does not designate a product
release. It records development and integration identities only.

## Owner-Accepted Architecture Development Baseline

```text
Branch lineage: integration/architecture-development
Accepted baseline: ea46678cbb955b7aeb093dc34525c52325af9cae
First parent:      c15a03e138e21328a3db0c88f861bca1b6af7e8c
Second parent:     06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35
```

The second parent is the final approved PR-INGREDIENT-003C Head. This accepted
baseline contains:

- the earlier Measurement, Ingredient/Profile, Recipe projection, Cost
  evidence/evaluation, and Cost Back Office development capabilities;
- Recipe 001A Domain correction and Draft behavior; and
- Recipe 001B Migration 017, persistence, Unit-of-Work, receipt, restart, and
  fail-closed Published pointer remediation; and
- PR #11 nested SQLite savepoint semantics, ordered cleanup, and retained
  primary/cleanup failure evidence after its authorized remediation;
- PR-INGREDIENT-003A synchronous Rename and Archive Application commands,
  version-first precedence, stable errors, and non-blocking duplicate warnings;
  and
- PR-INGREDIENT-003B deterministic Active/Archived management reads, SQLite
  persistence, server composition, and management APIs; and
- PR-INGREDIENT-003C API-backed management UI/navigation with safe rendering,
  version-aware Rename/Archive flows, conflict recovery, and responsive E2E
  evidence.

It is an architecture-development/integration baseline only. It is not remote
`main`, main promotion, a deployed runtime, a production database identity, or
a formal product release.

## Current integration Head after PR #23

```text
Remote branch: integration/architecture-development
Verified Head: ea46678cbb955b7aeb093dc34525c52325af9cae
First parent:  c15a03e138e21328a3db0c88f861bca1b6af7e8c
Second parent: 06929a7c73e370e1a2e0ba4fd230cdbdb0f19a35
```

PR #23 implemented the independently reviewed Ingredient 003C UI/navigation
scope. The Owner separately designated its merge commit as the Architecture
Development Baseline after passing post-merge validation. The prepared
governance closeout is not effective until independently reviewed and merged.

## Main and remote-default state

- Remote `main`: nonexistent when verified.
- Local `main`: unpromoted at
  `2616fc86f5b1e81ba33ea05c71b561a8f0210e36`.
- `origin/HEAD`: observed pointing to `origin/feature/pr-measure-001` at
  `8b80e9723d55c1e6dc0e30a6c83cb9e52effe20e`.

The `origin/HEAD` observation is abnormal repository state, not an accepted
default-branch change. This task does not modify it.

## Capability, test, runtime, and release boundaries

- Source capability is established by contained implementation and contract
  evidence.
- Test evidence is established only by the named commands and selections that
  actually ran; overlapping selections are not summed.
- Runtime evidence is limited to the dated 2026-08-09 observation documented
  in `docs/bootstrap/CURRENT_AI_HANDOVER.md` and does not identify a Git SHA or
  deployed database.
- Cost Back Office is contained in development integration but is not formally
  released or deployment-verified. COST-REGRESSION-001 is completed and its
  post-merge verification passed; that does not make the product release-ready.
- Ingredient 003A and 003B are closed. Ingredient 003C implementation is
  technically complete; its governance closeout is pending this documentation
  workflow. Ingredient 003D and the Reference Impact Coordinator remain
  unauthorized.
- Recipe 001C through 001E remain unauthorized.

## Promotion gate

No technical ancestry, mergeability, branch containment, or passing test suite
authorizes promotion. Remote `main` creation, main promotion, deployment, and a
product release each require separate Owner authorization and verified runtime
and database evidence appropriate to that gate.

This document grants no feature, commit, push, merge, cleanup, release, or
deployment authority.
