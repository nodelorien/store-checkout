---
layer: L3
component: frontend
read-when: touching the Redux store, slices, selectors, RTK Query endpoints or localStorage persistence
---

# State management

Flux, unidirectional: **view → action/thunk → reducer → selector → view**.

## Store shape

```ts
{
  api: RTKQueryState,                 // products, paymentConfig, transactions cache
  checkout: {
    step: 'PRODUCTS' | 'PAYMENT_INFO' | 'SUMMARY' | 'STATUS',
    productId: string | null,
    quantity: number,
    delivery: { fullName, email, phone, addressLine1, addressLine2, city, region, postalCode } | null,
    card: { tokenId: string, brand: 'VISA' | 'MASTERCARD', lastFour: string, expiresAt: string } | null,
    acceptedTerms: boolean,
    idempotencyKey: string | null,
    submission: { status: 'idle' | 'tokenizing' | 'paying' | 'failed', error: UiError | null },
    notice: string | null,
  },
  transaction: {
    id: string | null, reference: string | null, status: TransactionStatus | null,
    polling: { attempts: number, timedOut: boolean },
  },
}
```

Never add card number / CVC / expiry / holder to this shape.

## RTK Query (`shared/api/baseApi.ts`)

| Endpoint | Tags |
|---|---|
| `getProducts` (query) | provides `Products` |
| `getPaymentConfig` (query) | provides `PaymentConfig` |
| `createTransaction` (mutation) | invalidates `Products` and `PaymentConfig` (on success and failure) |
| `getTransaction` (query) | provides `Transaction:{id}`; a final status invalidates `Products` |

`baseQuery` unwraps `{ data }` and normalises every failure into
`UiError { code, message, status, requestId }`. `message` is our own copy mapped from `code`
(`shared/api/uiError.ts`); server and gateway messages are never rendered verbatim.
Base URL from `env.apiBaseUrl` (`/api/v1` in production — same origin).

The acceptance token inside `PaymentConfig` is **single-use**: `confirmPayment` always refetches
the config right before `POST /transactions`, and the token is never persisted.

## Thunks and listeners

- Slices only know events; thunks live next to them (`checkout/thunks.ts`,
  `checkout/confirmPayment.ts`, `transaction/thunks.ts`) and are listed in `checkout-flow.md`.
- `submitPaymentInfo` is a hand-written thunk, **not** `createAsyncThunk`: that helper copies its
  argument into `meta.arg` of every action, which would put card data in Redux actions.
- `checkout/listeners.ts` (listener middleware) keeps the checkout consistent with the catalogue:
  selected product missing or sold out → reset with a notice; quantity above stock → reduced.

## Selectors (`features/checkout/selectors.ts`)

Memoised with `createSelector`. Components never compute.

- `selectSelectedProduct` (joins `productId` with the products cache)
- `selectOrderAmounts` → `{ subtotalInCents, baseFeeInCents, deliveryFeeInCents, totalInCents }`
- `selectIsCardTokenValid` (not null and `expiresAt` in the future, given a `now` argument)
- `selectIsOrderPayable`, `selectCanPay`, `selectCheckoutStep`, `selectMaxQuantity`

## Persistence (`app/persistence/`)

| File | Role |
|---|---|
| `snapshot.ts` | `toSnapshot(state)` — builds the **allow-listed** object; `fromSnapshot(raw)` — validates with Zod, checks `version`, returns preloaded state or `undefined` |
| `storage.ts` | safe `load()` / `save()` / `clear()` around `localStorage` (try/catch, quota, private mode) |
| `persistenceMiddleware.ts` | RTK listener middleware; whenever the `checkout` or `transaction` slice changed, debounced save (250 ms); an empty flow removes the key |

`app/bootstrap.ts` preloads the store from the snapshot, runs `resumeCheckout()` and flushes the
snapshot on `pagehide`, so a refresh inside the debounce window loses nothing.

Storage key `checkout:v1`. Snapshot fields:

```ts
{ version: 1, savedAt: ISO,
  checkout: { step, productId, quantity, delivery, card: { tokenId, brand, lastFour, expiresAt },
              acceptedTerms, idempotencyKey },
  transaction: { id, reference, status } }
```

Rules:
- Allow-list, never block-list. A new slice field is **not** persisted until added to `toSnapshot`.
- `submission`, `notice`, `polling` and the RTK Query cache (so also the acceptance token) are never persisted.
- Invalid, old-version, inconsistent or older-than-24h snapshots are discarded silently.
- Removed when the flow is reset (`finishCheckout`, sold out, product unavailable); an expired card token is dropped from it.
- Delivery data is personal data: it stays on the device, is cleared at the end of the flow, and
  is never sent anywhere except our API.

## Flux alignment checklist

- One store; state changes only through dispatched actions.
- Reducers are pure (RTK/Immer); side effects only in thunks and listener middleware.
- Action names are events in the past tense or intents: `checkout/productSelected`,
  `checkout/paymentInfoSubmitted`, `checkout/reset`.
