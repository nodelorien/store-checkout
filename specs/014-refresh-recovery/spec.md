# Spec 014 — Refresh recovery

- Status: Done
- Component(s): frontend
- Branch: `feat/014-refresh-recovery`
- Traces to: FR-11, NFR-05
- Context to load: `docs/components/frontend/CONTEXT.md`, `checkout-flow.md#refresh-recovery-fr-11`, `state.md#persistence`

## 1. Why

A reload, an accidental swipe or a tab restored by the browser must not make the customer start
over, pay twice, or lose track of a payment that is already in flight — and must never bring card
data back from storage.

## 2. Scope

**In:** resuming each step from the persisted snapshot at start-up; guards that make a restored
state safe (expired card token, product no longer purchasable, quantity above stock); end-to-end
tests of the five-screen flow including a refresh at every step.

**Out:** changing what is persisted (defined in 009); server-side recovery.

## 3. Behaviour

At start-up the store is preloaded from the snapshot (009) and the checkout is resumed:

| State when the page was reloaded | After the reload |
|---|---|
| Product page, nothing in progress | product page |
| Payment-info step | dialog reopens for the same product and quantity; delivery fields and the terms tick are restored; **card fields are empty** |
| Summary, card token still valid | summary reopens with brand and last four; paying uses the same idempotency key |
| Summary, card token expired | payment-info step with the notice "Please re-enter your card" |
| Status step | `/transactions/:id` is shown (also when the reload happened on `/`); polling resumes while `PENDING` |
| Selected product missing from the catalogue or sold out | product page with a notice |
| Payment request in flight | summary reopens; paying again sends the same `Idempotency-Key`, so the API returns the original transaction instead of charging twice |

The product-availability guard also applies during a session (for example "Try again" on a product
that sold out meanwhile), and a quantity above the current stock is reduced to the stock.

## 4. Acceptance criteria

- **AC-1** — Reload with nothing persisted shows the product page.
- **AC-2** — Reload on the payment-info step reopens the dialog for the same product with delivery
  data restored and all four card inputs empty.
- **AC-3** — Whatever was typed in the card form, the stored snapshot never contains it.
- **AC-4** — Reload on the summary with a valid token reopens the summary with brand and last four.
- **AC-5** — Reload on the summary with an expired token goes to the payment-info step with the notice.
- **AC-6** — Reload in the status step shows the status page, from `/transactions/:id` and from `/`, and polls while pending.
- **AC-7** — Given the restored product is missing or has stock 0, the checkout resets to the products with a notice.
- **AC-8** — Reload while a payment is in flight, then paying again, sends the same idempotency key.
- **AC-9** — A quantity above the current stock is reduced to the stock.
- **AC-10** — Full flow: product page → modal → summary backdrop → approved status → back to the
  product page with the stock refetched.
- **AC-11** — Declined flow: "Try again" returns to the card step, and the second attempt sends a
  different acceptance token and a different idempotency key than the first.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Catalogue fails to load after a reload | product page error with retry; the overlay appears once products load |
| Snapshot invalid or older than 24 h | ignored (009) |
| Reload within the persistence debounce window | the snapshot is flushed on `pagehide` (009) |

## 6. Contract changes

None.

## 7. Security and privacy notes

The acceptance token and all card fields are absent from the snapshot; after a reload the card
must be typed again unless a still-valid gateway token exists.

## 8. Plan and tasks (merged)

- [x] T01 `resumeCheckout` thunk, run by `bootstrapStore`
- [x] T02 Checkout listener: product availability and quantity guards
- [x] T03 Integration tests: full flow, declined retry, refresh at every step
- [x] T04 Docs: `state.md`, `checkout-flow.md`, `ui.md`, `testing.md`
- [x] T90 lint, format, typecheck, test:cov, build green
