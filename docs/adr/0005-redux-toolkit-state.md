# ADR-0005: Redux Toolkit + selective persistence

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-01, FR-11, NFR-05

## Context

Redux is mandatory (Flux architecture). The app must recover the customer's progress after a
refresh, and must store payment transaction data "securely in application state or localStorage".
Lighter stores (Zustand, Context) are therefore not an option, whatever the team preference.

## Decision

- **Redux Toolkit** store. Feature slices: `checkout` (step, selected product, quantity, delivery
  form, card *display* data, card token), `transaction` (current transaction + status).
- **RTK Query** for server data (`products`, `payment-config`, `transactions`): caching, loading
  states and tag invalidation to refetch stock after a purchase.
- Unidirectional flow: components dispatch actions/thunks and read through memoised selectors.
  No API calls or business rules inside components.
- **Persistence:** a small custom listener middleware writes an allow-listed, versioned snapshot
  to `localStorage` and rehydrates it as `preloadedState`. Allow-list only:
  step, productId, quantity, delivery form, card brand + last4 + token id + token expiry,
  transaction id/reference/status.
- **Never persisted, never in Redux:** card number, CVC, expiry, holder name as typed. They live in
  local form state (React Hook Form) and are discarded after tokenization.
- Snapshot is cleared when the flow completes or the token expires.

## Consequences

- Positive: refresh at any step resumes the flow; sensitive data cannot leak via storage or Redux DevTools.
- Positive: custom persistence is ~40 lines and fully unit-testable (no `redux-persist` dependency).
- Negative: if the user refreshes before tokenizing, card fields must be retyped (acceptable and safer).

## Alternatives rejected

- `redux-persist` — works, but its blacklist model makes it easy to persist a sensitive field by accident.
- Plain thunks + manual fetch — more boilerplate and hand-written cache/loading state.
- Zustand — not allowed by the brief.
