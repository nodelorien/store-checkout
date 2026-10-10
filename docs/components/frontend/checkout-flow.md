---
layer: L3
component: frontend
read-when: changing checkout steps, navigation guards, refresh recovery or status polling
---

# Checkout flow

## Steps

| # | Step id | UI | Route | Enter when |
|---|---|---|---|---|
| 1 | `PRODUCTS` | `ProductsPage` — product cards, stock, "Pay with credit card" | `/` | default |
| 2 | `PAYMENT_INFO` | `CheckoutDialog` (MUI `Dialog`, full-screen on xs) with `CardForm` + `DeliveryForm` | `/` (overlay) | product selected |
| 3 | `SUMMARY` | `SummaryBackdrop` (MUI `Backdrop` + bottom sheet) with amounts + "Pay" | `/` (overlay) | card tokenized and delivery valid |
| 4 | `STATUS` | `TransactionStatusPage` — result, reference, amounts | `/transactions/:id` | transaction created |
| 5 | `PRODUCTS` | back to catalogue, stock refetched | `/` | user clicks "Back to store" (or auto after approval countdown) |

Steps 2 and 3 are overlays on the product page driven by `checkout.step` in Redux, not by routes;
step 4 is a route so the result URL is shareable/reloadable.

## Transitions

```
PRODUCTS ──selectProduct──► PAYMENT_INFO ──submitPaymentInfo (tokenize ok)──► SUMMARY
   ▲                             ▲   │                                           │
   │                             └───┼──────────── editPaymentInfo ──────────────┤
   │                    closeDialog  ▼                                           │ confirmPayment
   └──────────────────────────── PRODUCTS                                        ▼
   └──────────── finishCheckout ◄──────────────────────────────────────────── STATUS
```

## Thunks

| Thunk | Does |
|---|---|
| `submitPaymentInfo(card, delivery)` | calls `tokenizeCard` (gateway, public key) → stores `{ tokenId, brand, lastFour, expiresAt }` + delivery + a new idempotency key (an existing key is kept) → step `SUMMARY`. Card fields are dropped here. |
| `confirmPayment()` | guards (token not expired, order payable, not already paying) → **fresh** `GET /payment-config` (single-use acceptance token) → `POST /transactions` with the persisted `Idempotency-Key` → stores transaction → step `STATUS`; the store route then redirects to `/transactions/:id` |
| `pollTransaction(id)` | while status is `PENDING`: `GET /transactions/:id` every 2 s, max 30 attempts, then show "still processing" with a "Check again" button; aborted when the page is left |
| `finishCheckout()` | clears checkout + transaction slices (the persistence listener removes the snapshot), invalidates `Products`; the page navigates to `/` |
| `retryPayment(productId)` | after a failed payment: step `PAYMENT_INFO` for the same product, delivery kept, card token and idempotency key dropped, `PaymentConfig` invalidated |
| `resumeCheckout()` | at start-up: a restored `SUMMARY` without a valid card token goes back to `PAYMENT_INFO` with a notice |

The dialog stays mounted (hidden) during `SUMMARY`, so "Edit details" finds the card still typed
in the form's own state; after a refresh the card inputs are empty.

## Refresh recovery (FR-11)

On boot the store is preloaded from the persisted snapshot (`state.md`), then `resumeCheckout()` runs:

| Persisted state | Result after refresh |
|---|---|
| nothing / step `PRODUCTS` | product page |
| step `PAYMENT_INFO` | dialog reopens with the same product; delivery fields prefilled; **card fields empty** (never persisted) |
| step `SUMMARY`, token still valid | summary backdrop reopens with brand + last four |
| step `SUMMARY`, token expired or missing | back to `PAYMENT_INFO` with a notice "Please re-enter your card" |
| step `STATUS` with transaction id | navigate to `/transactions/:id`, refetch; resume polling if `PENDING` |
| selected product no longer exists / stock 0 | reset to `PRODUCTS` with a notice |

Double-submit protection: the "Pay" button is disabled while `confirmPayment` is pending, and the
idempotency key is generated when entering `SUMMARY` and persisted, so a refresh mid-request
followed by a retry cannot charge twice.

## Status screen

| Status | Presentation | Action |
|---|---|---|
| `APPROVED` | success icon, reference (copy), total, order tracking | "Back to store" · "Print receipt" |
| `DECLINED` | error icon, gateway message if any, "What you can do" | "Try again" (→ `PAYMENT_INFO`, same product) · "Back to store" |
| `ERROR` / `VOIDED` | error icon, generic message | same as declined |
| `PENDING` | spinner, "Processing your payment…" | auto-poll; "Check again" after timeout |

Order tracking (spec 020) reads `GET /transactions/:id/delivery`: paid → preparing (`PENDING`) →
on its way (`SHIPPED`) → delivered. The journey is shown to anyone with the link; the address and
"Edit address" (`PATCH /deliveries/:id`, only while `PENDING`) only on the device whose checkout
produced the transaction. The summary also offers card instalments, sent as `installments`.

Request failures (network, 409 `OUT_OF_STOCK`, 422, 502) stay on the summary with an inline
`Alert` and a retry affordance; `OUT_OF_STOCK` sends the user back to `PRODUCTS`.

## Card validation (client-side, UX only)

- Number: digits only, formatted in groups of 4, Luhn check, length 13–19.
- Brand detection while typing: VISA `^4`; MasterCard `^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))`. Show the logo in the field adornment; other brands → generic icon and "Only VISA and MasterCard are accepted".
- Expiry `MM/YY`: valid month, not in the past. CVC: 3 digits (4 only if AMEX were supported). Holder: ≥ 5 chars.
- Must explicitly accept the gateway's terms (checkbox linking to the acceptance permalink).
