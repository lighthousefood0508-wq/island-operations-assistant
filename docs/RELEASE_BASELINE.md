# ROS Architecture Development Baseline

Last verified: 2026-08-09 (Asia/Taipei)

Governance basis: DECISIONS #055, #058, #059, #064, #065, #066,
#069, and #070.

Despite this historical filename, this document does not designate a product
release. It records development and integration identities only.

## Owner-Accepted Architecture Development Baseline

```text
Branch lineage: integration/architecture-development
Accepted baseline: 6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7
First parent:      29e120096455e26f70dce291a5249e43026b3550
Second parent:     ab662a48c0bdfcf835d5c2af2ac002abba8d55a0
```

The second parent is the final approved Recipe 001B Head. This accepted
baseline contains:

- the earlier Measurement, Ingredient/Profile, Recipe projection, Cost
  evidence/evaluation, and Cost Back Office development capabilities;
- Recipe 001A Domain correction and Draft behavior; and
- Recipe 001B Migration 017, persistence, Unit-of-Work, receipt, restart, and
  fail-closed Published pointer remediation.

It is an architecture-development/integration baseline only. It is not remote
`main`, main promotion, a deployed runtime, a production database identity, or
a formal product release.

## Current integration Head after PR #8

```text
Remote branch: integration/architecture-development
Verified Head: b107c6c7a4a2caca25bd46b138bd8baebbd97c1b
First parent:  6128f8e853b9ac96e2d6870b3a97ffde9d0bf5d7
Second parent: 70b6dab1159a3e8f10c951aca4a2992691cdf971
```

PR #8 added only the Owner-approved documentation synchronization Task Card.
Its merge advances the integration branch tip but does not redefine the
accepted capability baseline or create release authority.

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
  released or deployment-verified.
- Recipe 001C through 001E remain unauthorized.

## Promotion gate

No technical ancestry, mergeability, branch containment, or passing test suite
authorizes promotion. Remote `main` creation, main promotion, deployment, and a
product release each require separate Owner authorization and verified runtime
and database evidence appropriate to that gate.

This document grants no feature, commit, push, merge, cleanup, release, or
deployment authority.
