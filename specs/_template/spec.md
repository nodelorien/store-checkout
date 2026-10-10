# Spec NNN — <Feature name>

- Status: Draft | Approved | In progress | Done
- Component(s): backend | frontend | infra
- Branch: `feat/NNN-slug`
- Traces to: FR-xx, NFR-xx, BR-xx
- Context to load: `docs/components/<c>/CONTEXT.md`, `<topic>.md` (list only what is needed)

## 1. Why

One or two sentences: the user/business outcome.

## 2. Scope

**In:**
-

**Out:**
-

## 3. Behaviour

Describe observable behaviour from the outside (user or API consumer). No class or file names.

## 4. Acceptance criteria

Each criterion is independently testable and gets at least one test titled `AC-n: …`.

- **AC-1** — Given …, when …, then …
- **AC-2** — Given …, when …, then …

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| | |

## 6. Contract changes

Endpoints, payloads, state shape or env vars added/changed (or "none"). These must be mirrored in
`docs/components/backend/api.md` / `frontend/state.md` / `infra/CONTEXT.md` by the implementing PR.

## 7. Security and privacy notes

Sensitive data touched, validation, logging constraints (or "none").

## 8. Open questions

- [NEEDS CLARIFICATION] …  (must be empty before status `Approved`)
