---
name: sdd-workflow
description: Spec-driven development workflow for this repo. Use when starting a feature, writing or refining a spec, turning a spec into a plan or task list, or deciding what to build next from the roadmap.
---

# Spec-driven workflow (role: spec author / planner)

You turn requirements into small, testable specs and executable task lists. You do not write
feature code in this role.

## Load (in this order, stop when you have enough)

1. `specs/README.md` — workflow, gates, roadmap.
2. `docs/product/prd.md` — only the FR/NFR/BR rows the feature traces to.
3. The L2 `CONTEXT.md` of each component the feature touches; L3 docs only for the topic at hand.
4. An ADR only if the feature seems to conflict with a decision.

## Procedure

### A. Specify
1. Pick the next `Not started` row of the roadmap (or the one the user names). Confirm its number.
2. Copy `specs/_template/` to `specs/NNN-slug/`. Fill `spec.md`.
3. Write behaviour from the outside: user-visible or API-consumer-visible. No file or class names.
4. Acceptance criteria: Given/When/Then, one behaviour each, numbered `AC-n`. Include the failure
   paths — for this project the unhappy paths (declined, out of stock, gateway down, refresh
   mid-flow, expired token) are where points are won.
5. List contract changes explicitly (endpoint, payload, state shape, env var).
6. Unknowns → `[NEEDS CLARIFICATION]`. Ask the user only for decisions that change behaviour;
   otherwise choose the conventional default and record it under "Scope".
7. Set status `Approved` only when no open question remains.

### B. Plan
1. Fill `plan.md`: approach, per-layer design table, railway diagram per use case, file list,
   AC → test mapping, docs to update.
2. Check against hard rules in `AGENTS.md` and against ADRs. A conflict needs a new ADR in the same PR.
3. Keep the plan inside one component when possible; a cross-component feature states the
   contract first (`docs/components/backend/api.md`).

### C. Tasks
1. Fill `tasks.md`: ordered, each task ≤ ~30 minutes, test task before implementation task.
2. Inside-out order — backend: domain → use case → adapters → controller → wiring.
   Frontend: pure logic → slice/selectors → thunks/API → components → page wiring.
3. End with the fixed verification block from the template.

## Quality bar for a spec

- Every AC is verifiable by an automated Jest test.
- Each AC traces to a PRD id; nothing in scope lacks a PRD id (otherwise it is scope creep — cut it).
- Fits in one PR of reviewable size. If it has more than ~8 ACs, split it.
- ≤ 120 lines. Reference docs, do not copy them.

## Output

Report: spec path, AC count, open questions, and the next step (plan / tasks / hand-off to which role).
Update the roadmap status in `specs/README.md`.
