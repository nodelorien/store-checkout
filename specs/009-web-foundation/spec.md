# Spec 009 — Web foundation

- Status: Done
- Component(s): frontend
- Branch: `feat/009-web-foundation`
- Traces to: NFR-01, NFR-05, FR-11
- Context to load: `docs/components/frontend/CONTEXT.md`, `state.md`, `ui.md`, `testing.md`, `docs/components/backend/api.md`

## 1. Why

Every screen of the checkout needs the same plumbing: one Redux store, a typed API layer that
speaks the frozen HTTP contract, a theme, routes, an application shell and a safe way to keep the
customer's progress across a browser refresh.

## 2. Scope

**In:** store with `api`, `checkout` and `transaction` reducers; RTK Query base API (envelope
unwrapping, error normalisation, the four endpoints the web app consumes); theme; routes (`/`,
`/transactions/:id`, not found); app shell; error boundary; money formatting; allow-listed
persistence (snapshot, storage, debounced listener middleware); store bootstrap from the snapshot;
MSW test server, builders and render helper.

**Out:** product grid (010), checkout dialog and tokenization (011), summary and payment (012),
status page and polling (013), resume rules beyond loading the snapshot (014).

## 3. Behaviour

- The shell shows the store name "Lumen Store" on every route and a main landmark.
- API responses `{ data }` are unwrapped; `{ error: { code, message, details, requestId } }` and
  transport failures become a `UiError { code, message, status, requestId }` with user-facing copy.
- Changes to the checkout or transaction state are saved to `localStorage` under `checkout:v1`
  after a short debounce, as an allow-listed snapshot. On start the snapshot is validated and used
  to preload the store; anything invalid, of another version or older than 24 h is discarded.
- Money is formatted from integer cents as COP without decimals.

## 4. Acceptance criteria

- **AC-1** — The shell renders the store name as the page heading on any route.
- **AC-2** — Given a `200 { data }` response, the API layer returns the unwrapped `data`.
- **AC-3** — Given an error envelope, a network failure or an unexpected body, the API layer returns
  a `UiError` with the envelope's `code` (or a transport code) and friendly copy.
- **AC-4** — `createTransaction` sends `POST /transactions` with the `Idempotency-Key` header.
- **AC-5** — The persisted snapshot contains only the allow-listed fields; no key or value of card
  number, CVC, expiry or holder name can appear in it even if such data were injected into state.
- **AC-6** — A snapshot that is malformed, has another version, is older than 24 h or is
  inconsistent (overlay step without product, status step without transaction) is discarded.
- **AC-7** — Checkout/transaction changes are saved debounced; an empty flow removes the stored key;
  storage failures (quota, private mode) never throw.
- **AC-8** — The store boots preloaded from a valid snapshot and from defaults otherwise.
- **AC-9** — `formatMoney(12990000)` renders 129.900 COP with the peso sign and no decimals.
- **AC-10** — An unknown route shows a not-found message with a link back to the store.
- **AC-11** — A rendering crash shows a recoverable error screen instead of a blank page.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| `localStorage` unavailable or full | flow works without persistence, no error surfaced |
| Non-JSON error body (proxy 502) | `UiError` derived from the HTTP status |
| 429 without envelope | code `RATE_LIMITED` |

## 6. Contract changes

State shape as in `state.md` (the scaffold `app` slice is removed; the store name is a constant).
`UiError` is `{ code, message, status, requestId }`. No endpoint changes.

## 7. Security and privacy notes

Persistence is an allow-list built field by field. Card number, CVC, expiry and holder name are
not part of any slice. Server error messages are not rendered verbatim; copy is mapped from `code`.

## 8. Plan and tasks (merged)

- [x] T01 `shared/lib` (formatMoney, uuid, delay) + `Money`
- [x] T02 `shared/api` types, `UiError` normaliser, base query, endpoints + MSW server/builders
- [x] T03 `checkout` and `transaction` slices (state shape, events)
- [x] T04 `app/persistence` snapshot, storage, listener middleware; `app/bootstrap`
- [x] T05 theme, `AppShell`, `ErrorBoundary`, routes, not-found page, `renderWithProviders` with router
- [x] T90 lint, typecheck, test:cov green; docs updated
