# ROS Architecture Development Baseline

Last verified: 2026-08-10 (Asia/Taipei)

Governance basis: DECISIONS #055, #058, #059, #064, #065, #066,
#069, and #070.

Despite this historical filename, this document does not designate a product
release. It records development and integration identities only.

## Owner-Accepted Architecture Development Baseline

```text
Branch lineage: integration/architecture-development
Accepted baseline: 97d6c7b52f09643b2cafaa50711f76ccc1ae7a96
First parent:      5c2a69282567c6456a5d2e7e2628270a03847e57
Second parent:     784bb00912fd957dab6a84448dd8f640f0e166fc
```

The second parent is the final approved PR-INGREDIENT-003B Head. This accepted
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
  persistence, server composition, and management APIs.

It is an architecture-development/integration baseline only. It is not remote
`main`, main promotion, a deployed runtime, a production database identity, or
a formal product release.

## Current integration Head after PR #19

```text
Remote branch: integration/architecture-development
Verified Head: 58cce2327f3f7121442e8a0cd4cd29693b9fde3c
First parent:  97d6c7b52f09643b2cafaa50711f76ccc1ae7a96
Second parent: 7c80fbd13bb196d9c78e938baeb9625a6658e1d3
```

PR #19 added only the Owner-approved post-PR18 Ingredient 003B governance
closeout Task Card. Its merge advances the integration branch tip but does not
redefine the accepted capability baseline, complete the 14-file documentation
synchronization, or create release authority.

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
- Ingredient 003A and 003B are completed and merged. Ingredient 003C,
  UI/navigation, and the Reference Impact Coordinator remain unauthorized.
- Recipe 001C through 001E remain unauthorized.

## Promotion gate

No technical ancestry, mergeability, branch containment, or passing test suite
authorizes promotion. Remote `main` creation, main promotion, deployment, and a
product release each require separate Owner authorization and verified runtime
and database evidence appropriate to that gate.

This document grants no feature, commit, push, merge, cleanup, release, or
deployment authority.
