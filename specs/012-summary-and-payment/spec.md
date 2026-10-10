# Spec 012 — Summary and payment

- Status: Done
- Component(s): frontend
- Branch: `feat/012-summary-and-payment`
- Traces to: FR-06, FR-07, BR-01, BR-02, NFR-05
- Context to load: `docs/components/frontend/CONTEXT.md`, `checkout-flow.md`, `state.md`, `ui.md`, `docs/components/backend/api.md`

## 1. Why

Before being charged the customer must see exactly what they will pay — product, base fee,
delivery fee and total — and confirm with one deliberate action that can never charge twice.

## 2. Scope

**In:** summary shown in a Material `Backdrop` as a bottom sheet over the dimmed product page;
order amounts; payment method and delivery recap; "Pay" action creating the transaction; error
handling on the summary; going back to edit.

**Out:** the status screen and polling (013); resuming the summary after a refresh (014).

## 3. Behaviour

- After the payment-info step succeeds, the product page is dimmed by a backdrop and a sheet slides
  up (bottom sheet on phones, centred card on wider screens) titled "Order summary".
- Rows: product name × quantity with its amount, "Base fee", "Delivery fee" and "Total"
  (= price × quantity + base fee + delivery fee, fees from `GET /payment-config`).
- It also shows the card brand logo with the last four digits and the delivery address.
- The primary button reads "Pay" followed by the total. Pressing it:
  1. fetches a fresh payment configuration (the acceptance token is single-use, a cached one must never be reused);
  2. sends `POST /transactions` with product, quantity, card token, brand, last four,
     `installments: 1`, the acceptance token, customer and delivery data, and the persisted
     `Idempotency-Key`. Prices and fees are never sent;
  3. on `201`/`200` stores the transaction and moves the checkout to the status step.
- While paying, the button shows progress and is disabled, and the sheet cannot be dismissed.
- Request failures (network, 400, 422, 429, 502, 500) keep the customer on the summary with an alert
  and the button available to retry (same idempotency key, new acceptance token).
  `409 OUT_OF_STOCK` returns to the products with a notice.
- If the card token has expired, the customer is sent back to the payment-info step with the
  notice "Please re-enter your card".
- "Edit details", `Esc` or a click on the dimmed area go back to the payment-info step (not while paying).

## 4. Acceptance criteria

- **AC-1** — The summary shows subtotal, base fee, delivery fee and a total equal to their sum, for any quantity.
- **AC-2** — The summary is rendered inside a Material `Backdrop`, as a labelled modal dialog.
- **AC-3** — It shows the card brand with the last four digits and the delivery address.
- **AC-4** — Pressing "Pay" posts the transaction with the contract's body (no prices, optional
  empty fields omitted, `country: "CO"`) and the `Idempotency-Key` header; on success the step becomes `STATUS`.
- **AC-5** — While the request is in flight the pay button is disabled and a second press does not send a second request.
- **AC-6** — Given the API fails, an alert is shown, the step stays `SUMMARY`, and retrying sends
  the same idempotency key with a different (fresh) acceptance token.
- **AC-7** — Given `409 OUT_OF_STOCK`, the checkout returns to the products with a sold-out notice.
- **AC-8** — Given an expired card token, pressing "Pay" sends nothing and returns to the payment-info step with a notice.
- **AC-9** — "Edit details", `Esc` and a backdrop click return to the payment-info step; none of them does while paying.
- **AC-10** — While fees are loading the pay button is disabled; if they cannot be loaded an alert with retry is shown.
- **AC-11** — A declined card is not an error: `201` with `status: "DECLINED"` moves to the status step.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Payment config cannot be refreshed right before paying | alert, nothing is charged, retry possible |
| Refresh while the request is in flight | summary reopens; paying again reuses the idempotency key (see 014) |
| Quantity above current stock or incomplete state | alert, nothing sent |

## 6. Contract changes

None. `createTransaction` invalidates the `Products` and `PaymentConfig` tags on success and failure.

## 7. Security and privacy notes

Only the gateway token, brand and last four travel to the API. The acceptance token lives only in
the RTK Query cache (never persisted). Amounts shown are informative; the API recomputes them.

## 8. Plan and tasks (merged)

- [x] T01 `confirmPayment` thunk (guards, fresh config, request body, error routing)
- [x] T02 `SummaryBackdrop` (Backdrop + Slide + Paper, focus trap, safe area)
- [x] T03 Wire into `CheckoutFlow`
- [x] T90 lint, typecheck, test:cov green
