---
name: frontend-dev
description: Frontend engineering rules for apps/web (React, TypeScript, MUI, Redux Toolkit, RTK Query, mobile-first checkout flow). Use when building or changing pages, components, forms, Redux state, the checkout steps, refresh recovery or styling.
---

# Frontend engineer (React · MUI · Redux Toolkit)

## Load

1. `docs/components/frontend/CONTEXT.md` (always).
2. The feature's `specs/NNN-*/spec.md`, `plan.md`, `tasks.md`.
3. Only the L3 docs for what you touch: `checkout-flow.md` · `state.md` · `ui.md` · `testing.md`.
4. `docs/components/backend/api.md` only when calling or mocking an endpoint.

## Procedure

1. No approved spec → stop and use `sdd-workflow` first.
2. Build inside-out, test first: pure logic (validation, formatters) → slice + selectors →
   thunks / RTK Query endpoints → components → page wiring.
3. Design every screen at **375×667** first, then check 414, 768, 1280.
4. Run `npm run test -w apps/web -- <path>` while iterating; `npm run test:cov -w apps/web` before finishing.
5. Update `state.md` / `checkout-flow.md` / `ui.md` when you change what they describe.

## Non-negotiables

- **Redux is mandatory** (Flux). State that must survive a refresh lives in slices; server data
  in RTK Query; components only render and dispatch. Do not introduce Zustand, Context stores or
  ad-hoc `fetch` in components.
- **Card data never leaves `CardForm`** except to `tokenizeCard`. Never put number / CVC / expiry
  in Redux, localStorage, URLs, logs or error messages. Persistence is an allow-list (`state.md`).
- **Money** stays in integer cents; format only at render with `formatMoney` / `<Money />`.
- **The summary is a Backdrop component** (bottom sheet over a dimmed page) — brief requirement.
- **Responsive:** MUI `Stack` / `Box` / CSS grid, theme breakpoints and spacing. No fixed widths,
  no horizontal scroll at 320–375 px, touch targets ≥ 44 px, inputs ≥ 16 px font.
- **Images:** lightweight SVG, explicit dimensions or `aspect-ratio`, lazy below the fold, skeleton + error fallback.
- **Every async view handles** loading, empty, error (with retry) and success.
- **Accessibility:** labelled inputs with proper `autoComplete` and `inputMode`, `role="alert"`
  for errors, focus management in dialog/backdrop.
- **Double submit:** disable "Pay" while paying; send the persisted `Idempotency-Key`.
- **Naming:** never the payment provider's company name in code, copy or assets.
- Only `shared/config/env.ts` reads `import.meta.env`.

## Patterns

- Forms: React Hook Form + Zod resolver; schemas in `features/checkout/validation/`.
- Typed hooks `useAppDispatch` / `useAppSelector`; selectors via `createSelector`.
- Thunks via `createAsyncThunk` with `rejectWithValue(UiError)`; no raw error objects in state.
- Component files: `ComponentName.tsx` + `ComponentName.test.tsx`; one component per file.
- Tests query by role/label and use `renderWithProviders` with a `preloadedState`.

## Definition of done

- All tasks ticked; every `AC-n` has a passing test titled `AC-n: …`.
- `lint`, `typecheck`, `test:cov` green; coverage ≥ 80% (aim 90%+).
- Verified visually at 375 px: nothing overflows, primary action reachable.
- Refresh at the new/changed step restores it (or the spec says why not).
- Docs updated.

## Report back

Files changed, tests added (count + coverage summary), state-shape or contract changes, visual checks done.
