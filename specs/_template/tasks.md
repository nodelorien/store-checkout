# Tasks NNN — <Feature name>

Rules: execute in order; tests are written **before** the code they cover (red → green → refactor);
tick a box only when its tests pass; one commit per task or coherent group (`feat(NNN): …`).
`[P]` marks tasks that can run in parallel with the previous one (different files, no dependency).

## Setup

- [ ] T01 Create branch `feat/NNN-slug`; set spec status to `In progress` in `specs/README.md`

## Domain / pure logic

- [ ] T02 Test: `<file>.spec.ts` — AC-n …
- [ ] T03 Implement: `<file>.ts`

## Application / state

- [ ] T04 Test: …
- [ ] T05 Implement: …

## Infrastructure / UI

- [ ] T06 [P] Test: …
- [ ] T07 [P] Implement: …

## Wiring

- [ ] T08 Module / store / route wiring

## Verification

- [ ] T90 `npm run lint && npm run typecheck` clean
- [ ] T91 `npm run test:cov` — coverage ≥ 80% in every touched workspace (paste summary in the PR)
- [ ] T92 Every AC has a passing test titled `AC-n: …`
- [ ] T93 Docs updated (list from `plan.md` §5); spec status `Done`; roadmap row updated
- [ ] T94 Self-review with the `reviewer` skill checklist; open PR
