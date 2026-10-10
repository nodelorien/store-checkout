# Plan NNN — <Feature name>

- Spec: `./spec.md` (status must be `Approved`)
- ADRs relied on: 000x, 000y — new ADR needed? yes/no

## 1. Approach

Three to six sentences: how the behaviour is achieved within the existing architecture.

## 2. Design

### Backend (delete if not applicable)

| Layer | Element | New / changed | Notes |
|---|---|---|---|
| domain | | | |
| application (port / use case) | | | |
| infrastructure (http / persistence / gateway) | | | |

Railway of each use case (one line per step, with the error each step can emit):

```
step ──ok──► step ──ok──► step
  └─ ERR_CODE   └─ ERR_CODE
```

### Frontend (delete if not applicable)

| Kind | Element | New / changed | Notes |
|---|---|---|---|
| slice / action / thunk | | | |
| selector | | | |
| RTK Query endpoint | | | |
| component / page | | | |

### Infra (delete if not applicable)

Resources, env vars, permissions.

## 3. Files

```
apps/…/path/file.ts          new      purpose
apps/…/path/other.ts         change   what changes
```

## 4. Test plan

| AC | Test file | Test title |
|---|---|---|
| AC-1 | | `AC-1: …` |

## 5. Docs to update

- [ ] `docs/components/…`

## 6. Risks

| Risk | Mitigation |
|---|---|
| | |
