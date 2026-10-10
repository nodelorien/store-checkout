---
layer: L3
component: frontend
read-when: writing web tests or fixing web coverage
---

# Frontend testing

Jest (`jsdom`) + Testing Library (`@testing-library/react`, `user-event`, `jest-dom`).
Threshold 80% global; aim ≥ 90%. **Not Vitest** (ADR-0009).

## Jest setup notes

- Transform TS/TSX with `@swc/jest` (or `ts-jest`), JSX runtime `automatic`.
- `moduleNameMapper`: CSS → `identity-obj-proxy`; images/SVG files → a stub; `@/` → `src/`.
- `import.meta.env` is not available in Jest: only `shared/config/env.ts` reads it; tests mock that module.
- `setupFilesAfterEnv`: `jest-dom`, MSW server lifecycle (or `fetch` mock), `localStorage.clear()`.
- Node's `fetch`/`Response` polyfills for RTK Query under jsdom if needed (`whatwg-fetch` or `undici`).

## What to test

| Target | How |
|---|---|
| `validation/` (luhn, cardBrand, expiry, schemas), `lib/formatMoney` | pure unit, table-driven (`it.each`) |
| Slices | reducer tests: action → state |
| Selectors | fixed state → value (amounts, token validity with injected `now`) |
| Thunks | real store + mocked `tokenizeCard` / API; assert dispatched state transitions and error paths |
| Persistence | `toSnapshot` allow-list (**assert no card fields ever appear**), `fromSnapshot` rejects bad/old data, middleware saves, storage failure tolerated |
| RTK Query API layer | MSW handlers matching `backend/api.md`; envelope unwrapping + error normalisation |
| Components | render with `renderWithProviders(ui, { preloadedState })`; interact via `user-event`; query by role/label |
| Pages / flow | integration: product → dialog → summary → status with MSW; refresh recovery by re-rendering with a persisted snapshot |

## Conventions

- Files: `*.test.ts(x)` next to the source. Helpers in `src/test/`.
- Query priority: `getByRole` > `getByLabelText` > `getByText`; `data-testid` only as a last resort.
- Test names trace to specs: `it('AC-2: shows the VISA logo when the number starts with 4', …)`.
- No snapshot tests for whole pages; assert behaviour.
- Fake timers for polling and debounced persistence.

## Mandatory scenarios

1. Product list renders name, price, stock; CTA disabled when stock is 0.
2. Card form: invalid Luhn rejected; VISA/MasterCard logos switch while typing; expired date rejected.
3. Delivery form validation messages.
4. Summary shows subtotal + base fee + delivery fee = total.
5. Pay → approved → status screen → back to store → stock refetched.
6. Pay → declined → "Try again" returns to the card step.
7. Pending → polling → resolves.
8. API error on pay shows an alert and keeps the user on the summary.
9. Refresh at each step restores the right screen; card inputs are empty after refresh.
10. Persisted snapshot never contains `number`, `cvc`, `exp*`.

## Coverage config

Excluded only: `main.tsx`, `*.d.ts`, `src/test/**`, `shared/config/env.ts`, type-only files.
