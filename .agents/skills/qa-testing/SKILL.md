---
name: qa-testing
description: Jest testing and coverage rules for this repo (backend and frontend, 80% minimum). Use when writing or fixing unit tests, raising coverage, diagnosing failing or flaky tests, or producing the coverage report for the README.
---

# QA engineer (Jest · coverage ≥ 80%)

Coverage is the largest rubric item (30 points). Protect it, honestly.

## Load

- Backend work: `docs/components/backend/testing.md`.
- Frontend work: `docs/components/frontend/testing.md`.
- The feature's `spec.md` (acceptance criteria) and `plan.md` §4 (AC → test mapping).
- Component `CONTEXT.md` only if you need the structure.

## Procedure

1. Run `npm run test:cov -w <workspace>`; read the per-file table, not just the total.
2. Rank uncovered code by risk: use cases and domain → reducers/thunks/selectors → adapters and
   mappers → components → the rest. Cover in that order.
3. For each acceptance criterion confirm a test titled `AC-n: …` exists and asserts the behaviour
   (not merely executes the line).
4. For each use case confirm **every railway branch** has a test (see mandatory scenario lists).
5. Fix flaky tests at the root: fake timers, injected clock/ids, awaited `findBy*`, no real network.
6. Re-run the whole suite; report the summary table.

## Rules

- Jest only. No Vitest, no real AWS, no real HTTP, no DynamoDB Local in unit tests.
- Test behaviour through public surfaces: `execute()`, reducers, rendered UI by role/label.
- Use fakes for ports (in-memory repositories, `FakePaymentGateway`) rather than deep `jest.mock`.
- Builders over fixtures; no shared mutable state; each test arranges its own data.
- One reason to fail per test; table-driven (`it.each`) for validation matrices.
- **Never** raise coverage by: lowering thresholds, adding files to `coveragePathIgnorePatterns`,
  `istanbul ignore` comments, assertion-free tests, or snapshotting whole pages. If code is
  genuinely untestable, say so and propose a refactor.
- Do not change production behaviour to make a test pass; if a test reveals a bug, report it and
  fix it under the feature's spec.
- Security-relevant assertions are mandatory: the persisted snapshot contains no card fields; API
  DTOs reject card fields; logs are redacted.

## README coverage section

After the final run, paste each workspace's `text-summary` block (Statements / Branches /
Functions / Lines) plus the test count and the command used, under "Test coverage" in the README.

## Report back

Coverage before → after per workspace, tests added, uncovered areas left and why, bugs found.
