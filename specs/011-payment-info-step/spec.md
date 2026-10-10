# Spec 011 — Payment info step

- Status: Done
- Component(s): frontend
- Branch: `feat/011-payment-info-step`
- Traces to: FR-02, FR-03, FR-04, FR-05, NFR-05
- Context to load: `docs/components/frontend/CONTEXT.md`, `checkout-flow.md`, `state.md`, `ui.md`, `docs/components/backend/api.md`

## 1. Why

To pay, the customer gives card and delivery details. The card must be validated for typos,
exchanged for a gateway token directly from the browser, and then forgotten.

## 2. Scope

**In:** checkout dialog (full-screen on phones) opened from "Pay with credit card"; card form with
formatting, validation and VISA / MasterCard logo detection; delivery form; quantity stepper;
acceptance of the gateway terms; card tokenization against the gateway; move to the summary step.

**Out:** summary and payment (012); restoring this step after a refresh (014).

## 3. Behaviour

- Selecting a product opens a modal dialog titled "Checkout" showing the product, its unit price
  and a quantity stepper (1 to the smaller of stock and 10).
- Card section: number (grouped in fours, 13–19 digits, Luhn), name on card (≥ 5 characters),
  expiry `MM/YY` (valid month, not in the past), CVC (3 digits, masked).
- The VISA or MasterCard logo appears in the number field as soon as the prefix identifies the
  brand. Once four digits are typed and the brand is neither, the field says
  "Only VISA and MasterCard are accepted".
- Delivery section: full name, email, phone, address, apartment (optional), city, region, postal
  code (optional), validated with the same limits as the API.
- The customer must tick a checkbox accepting the terms, which links to the acceptance document
  given by `GET /payment-config`.
- "Continue to summary" validates everything, tokenizes the card with the gateway
  (`POST {tokenizationUrl}`, `Authorization: Bearer {publicKey}`) and, on success, stores only
  the token id, brand, last four and expiry of the token plus the delivery data, generates the
  idempotency key and moves to the summary step.
- Errors are shown inline per field, and gateway/network failures in an alert inside the dialog;
  the customer stays on this step and can retry.
- Closing the dialog returns to the products. Delivery data typed so far is remembered; card data
  is not kept anywhere outside the form.

## 4. Acceptance criteria

- **AC-1** — Given a product is selected, then a dialog shows the product, price, card and delivery sections.
- **AC-2** — The VISA logo shows when the number starts with 4, the MasterCard logo for 51–55 and
  2221–2720, switching while typing; other brands show "Only VISA and MasterCard are accepted".
- **AC-3** — A number failing the Luhn check, or with a wrong length, is rejected with an inline message.
- **AC-4** — An expired or malformed expiry date is rejected; the current month is accepted.
- **AC-5** — CVC must be 3 digits and the name on card at least 5 characters.
- **AC-6** — Delivery fields show validation messages for missing or malformed values; optional fields may be empty.
- **AC-7** — The terms checkbox is required and links to the acceptance permalink.
- **AC-8** — Given valid data, when continuing, then the gateway receives
  `{ number, cvc, exp_month, exp_year, card_holder }` with the public key as bearer token, and the
  checkout moves to `SUMMARY` holding `{ tokenId, brand, lastFour, expiresAt }`, the delivery data
  and an idempotency key.
- **AC-9** — Card number, CVC, expiry and holder never appear in the Redux state or in any dispatched action.
- **AC-10** — Given the gateway rejects the card (422) or is unreachable, then an alert in English
  is shown (gateway messages are not echoed), the step stays `PAYMENT_INFO` and retrying works.
- **AC-11** — The quantity can be changed between 1 and the maximum allowed; the controls disable at the limits.
- **AC-12** — Closing the dialog returns to the products and keeps the delivery draft.
- **AC-13** — While tokenizing, the submit button is disabled so the form cannot be sent twice.
- **AC-14** — Given the payment configuration cannot be loaded, then the dialog explains it,
  offers a retry and does not allow continuing.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Pasted number with spaces or dashes | digits are kept and regrouped |
| Gateway answers 2xx with an unexpected body or unsupported brand | generic error alert, no token stored |
| Phone typed with spaces or dashes | accepted; stored without separators |
| Product stock lower than chosen quantity | stepper caps at the stock |

## 6. Contract changes

None to the API. Gateway tokenization request/response mapping lives in `shared/gateway/`.

## 7. Security and privacy notes

Card data lives only in the form's component state and in the single tokenization request. The
thunk takes the card as a function argument and never puts it in an action. Gateway error bodies
are not rendered or logged. The link to the terms opens with `rel="noopener noreferrer"`.

## 8. Plan and tasks (merged)

- [x] T01 `validation/`: luhn, cardBrand, card formatting, expiry, Zod schemas (table-driven tests)
- [x] T02 `shared/gateway/`: `tokenizeCard` + isolated response mapping
- [x] T03 `submitPaymentInfo` thunk
- [x] T04 `CardBrandLogo`, `CardForm`, `DeliveryForm`, `QuantityStepper`
- [x] T05 `CheckoutDialog` + `CheckoutFlow`, wired into the product page
- [x] T90 lint, typecheck, test:cov green
