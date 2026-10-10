# Spec 013 — Transaction status

- Status: Done
- Component(s): frontend
- Branch: `feat/013-transaction-status`
- Traces to: FR-09, FR-10
- Context to load: `docs/components/frontend/CONTEXT.md`, `checkout-flow.md`, `state.md`, `ui.md`, `docs/components/backend/api.md`

## 1. Why

After paying, the customer needs an unambiguous answer — approved, declined, failed or still
processing — with the reference of the transaction, and a way back to the store where the stock
already reflects the purchase.

## 2. Scope

**In:** status page at `/transactions/:id`; presentation per status; polling while `PENDING`;
"Back to store" and "Try again"; redirect from the product page while a payment result is
pending acknowledgement; stock refresh when returning.

**Out:** restoring the page after a refresh with a persisted snapshot (014); amending a delivery.

## 3. Behaviour

- When the transaction is created the app navigates to `/transactions/:id`. While the checkout is
  in the status step, opening `/` leads back to that page until the customer leaves it explicitly.
- The page reads `GET /transactions/:id` and shows, from the API's response (source of truth): status,
  reference, product and quantity, subtotal, base fee, delivery fee, total and card brand with last four.
- `APPROVED`: success presentation, delivery address of the order, "Back to store".
- `DECLINED`: error presentation with the gateway's reason if present; "Try again" and "Back to store".
- `ERROR` / `VOIDED`: error presentation with a generic message; same actions as declined.
- `PENDING`: progress indicator and "Processing your payment…"; the transaction is re-read every
  2 s, at most 30 times. When it resolves the page updates by itself. If it does not, the page says
  it is still processing and offers "Check again", which restarts the polling.
- "Back to store" clears the checkout and transaction state (and so the persisted snapshot),
  refreshes the products and returns to `/`.
- "Try again" returns to the payment-info step for the same product, keeping the delivery data,
  with a new idempotency key and a new acceptance token; the card must be entered again.
- Loading shows a skeleton; an unknown id shows "Transaction not found"; other failures show an
  alert with "Retry".

## 4. Acceptance criteria

- **AC-1** — Given the checkout is in the status step, the product route redirects to `/transactions/:id`.
- **AC-2** — Approved: shows "Payment approved", the reference, the amounts returned by the API,
  the card and the delivery address, and only "Back to store".
- **AC-3** — Declined: shows "Payment declined" with the gateway reason, "Try again" and "Back to store".
- **AC-4** — Error and voided: generic failure copy with the same actions as declined.
- **AC-5** — Pending: shows the progress state, polls every 2 s and updates when the status resolves.
- **AC-6** — After 30 attempts still pending: shows "Still processing" and "Check again", which polls again.
- **AC-7** — "Back to store" resets checkout and transaction state, returns to `/` and the products are requested again (fresh stock).
- **AC-8** — "Try again" opens the payment-info step for the same product with delivery data kept and no card token or idempotency key.
- **AC-9** — Loading, not-found and failed-to-load states are handled; "Retry" requests again.
- **AC-10** — Polling stops when the page is left.
- **AC-11** — Status changes are announced through a polite live region.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| A poll request fails | counted as an attempt; polling continues |
| Page opened for a transaction that is not the one in progress | shown read-only; "Back to store" does not discard an unrelated checkout in progress |
| Product of a failed transaction is now sold out | "Try again" leads to the products with a notice (014) |

## 6. Contract changes

None. The transaction response has no delivery address, so the address shown on approval is the
one the customer just entered (kept in the checkout state until "Back to store").

## 7. Security and privacy notes

The page URL contains only the unguessable transaction id. No card data is involved.

## 8. Plan and tasks (merged)

- [x] T01 `pollTransaction`, `finishCheckout`, `retryPayment` thunks + selectors
- [x] T02 `TransactionStatus` component (per-status presentation, amounts, actions)
- [x] T03 `TransactionStatusPage` (query states, polling lifecycle, navigation)
- [x] T04 Route `/transactions/:id` and status redirect on `/`
- [x] T90 lint, typecheck, test:cov green
