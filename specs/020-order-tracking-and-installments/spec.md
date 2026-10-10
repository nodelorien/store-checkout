# Spec 020 — Order tracking, instalments and after-payment help

- Status: Done
- Component(s): frontend
- Branch: `feat/020-order-tracking-and-installments`
- Traces to: FR-07, FR-09, FR-10, FR-12, NFR-05
- Context to load: `docs/components/frontend/CONTEXT.md`, `checkout-flow.md`, `state.md`, `../backend/api.md`
- Plan and tasks: folded into this file

## 1. Why

The API already accepts card instalments and keeps a delivery per approved order, with an
endpoint to correct its address — but the store always paid in one instalment and never showed
the delivery again. After paying, the customer had a reference and nothing else to do with it.

## 2. Scope

**In:**
- Summary: choose the number of instalments (1, 2, 3, 6, 12, 24, 36), each with its amount.
- Result screen, approved: the order's journey (paid → preparing → on its way → delivered) read
  from the delivery; on the device that placed the order, the address and — while the order is
  being prepared — a way to correct it.
- Result screen, not approved: a short list of what the customer can do next.
- Result screen, approved: copy the reference, print a receipt.

**Out:**
- Changing the delivery status (no endpoint; it is an operator action).
- Changing the recipient, e-mail or phone after paying.
- Interest or financing calculations: the amount per instalment is the total divided evenly.
- E-mail or downloadable PDF receipts.

## 3. Behaviour

In the summary the customer picks a plan; a single payment is the default. The choice survives a
refresh, is sent with the payment and resets when another purchase starts.

Once a payment is approved the result screen shows the journey, with the current step marked. The
journey is visible to anyone holding the link; the address is not — it appears only where the
order was placed. While the order is being prepared that device can open "Edit address", change
it and see the new address at once. A payment that did not go through shows practical next steps.

## 4. Acceptance criteria

- **AC-1** — Given the summary with a known total, then each plan shows the amount of one payment
  (total ÷ instalments, rounded up to the peso) and a single payment is selected; without a total
  no plan is offered.
- **AC-2** — Given a chosen plan, when the customer pays, then that number of instalments is
  sent; it survives a refresh; it resets on a new purchase or on leaving the checkout; a number
  that is not offered falls back to 1; it cannot change while the payment is in flight.
- **AC-3** — Given an approved payment, then the result screen shows the four steps with those
  before the delivery's status done and its own step current (all done once delivered); a payment
  that was not approved shows no journey and requests no delivery.
- **AC-4** — Given the device that placed the order, then the delivery address is shown, and while
  the delivery is pending it can be edited: saving sends the corrected address and the screen
  shows it. Other devices see the journey only. A shipped order cannot be edited.
- **AC-5** — Given the address editor, when a field is invalid, then it is explained inline and
  nothing is sent; when the API answers that the delivery is no longer editable, then the dialog
  says so and stays open.
- **AC-6** — Given a declined, failed or voided payment, then "What you can do" lists next steps;
  an approved or pending payment shows none.
- **AC-7** — Given an approved payment, then the reference can be copied (with a confirmation
  announced politely) and the receipt printed; other results offer no receipt.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Delivery cannot be read | The result screen works as before, without the journey |
| Snapshot saved before instalments existed | Restored as a single payment |
| Optional address lines left empty | Not sent; the API keeps their previous value |
| Clipboard not available | Nothing is announced; the reference stays selectable |
| Printing | Header, footer and actions are hidden; dark ink on white |

## 6. Contract changes

No API change (uses `GET /transactions/:id/delivery` and `PATCH /deliveries/:id` as documented).
State: `checkout.installments` (number, default 1), added to the persisted allow-list.

## 7. Security and privacy notes

The address is shown only where the checkout that produced the transaction is still in the
store's state. No card data is involved. The reference is not secret; the clipboard receives only it.

## 8. Open questions

None.

## 9. Tasks

- [x] T01 Instalments: slice, selector, snapshot, request body, field (AC-1, AC-2)
- [x] T02 Delivery endpoints in the API client; tracking rules (AC-3)
- [x] T03 Tracker and address editor on the result screen (AC-3, AC-4, AC-5)
- [x] T04 Next steps, copy reference, print styles (AC-6, AC-7)
- [x] T90 Lint, typecheck, `test:cov` ≥ 80 %, docs (`checkout-flow.md`, `state.md`)
