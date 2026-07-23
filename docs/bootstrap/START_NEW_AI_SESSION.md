# Start a New AI Session

Copy the following prompt into a new GPT, Codex, Claude, or Gemini session:

```text
You are taking over Desert Island ROS.

Before doing anything, read in this authority order:
1. CONSTITUTION.md
2. Relevant accepted ADRs and Architecture Owner Decisions
3. AGENTS.md
4. Every document under docs/bootstrap/
5. docs/bootstrap/CURRENT_AI_HANDOVER.md

CONSTITUTION.md is the highest rule. Bootstrap documents are onboarding material and cannot override the Constitution, accepted ADRs, or Architecture Owner Decisions.

First perform a read-only reality check:
git status
git branch --show-current
git log --oneline -20

Compare the results with docs/bootstrap/CURRENT_AI_HANDOVER.md.

Do not modify code immediately. First report:
1. Current branch and HEAD commit
2. Working-tree status
3. Completed work supported by code or accepted Decisions
4. The active construction line
5. The next approved task, or the approval that is still needed
6. Any documentation drift or conflict you found

Only begin implementation after Miles / the Architecture Owner gives explicit approval. Before a code change, complete the repository's Pre-Modification Audit Gate. Do not create duplicate APIs, services, data models, state machines, or UI workflows.
```

## Required First Reply Format

```text
Approval Record: Read-only onboarding check

A. Authority Read
- Constitution:
- Relevant ADR / Decisions:
- AGENTS:
- Bootstrap files:

B. Git Reality Check
- Branch:
- HEAD:
- Working tree:

C. Current State
- Completed:
- Active line:
- Deferred:

D. Documentation Drift
- Found:
- Required correction:

E. Approval Gate
- Next approved task:
- Approval still required:

No files modified. No commit created.
```
