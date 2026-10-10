---
layer: L2
component: frontend
read-when: any work inside apps/web
---

# Frontend context (`apps/web`)

React SPA (Vite, TypeScript strict), MUI, Redux Toolkit + RTK Query (ADR-0005), React Router,
React Hook Form + Zod, Jest + Testing Library (ADR-0009). Mobile-first: design at 375×667 first.

## Deep dives (L3) — load only what you touch

| Doc | Read when |
|---|---|
| `checkout-flow.md` | changing steps, navigation, refresh recovery, polling |
| `state.md` | touching the store, slices, selectors, RTK Query, persistence |
| `ui.md` | building/styling components, theme, responsive rules, images |
| `testing.md` | writing tests or fixing coverage |
| `../backend/api.md` | consuming or mocking an endpoint (the contract) |

## Folder structure

```
apps/web/src/
  main.tsx  App.tsx
  app/
    store.ts  rootReducer.ts  hooks.ts          # typed useAppDispatch / useAppSelector
    persistence/                                # snapshot allow-list, load/save, listener middleware
    router.tsx  theme.ts
  features/
    products/     api (RTK Query endpoints), components, pages/ProductsPage
    checkout/     checkoutSlice, selectors, thunks, components (CardForm, DeliveryForm,
                  CheckoutDialog, SummaryBackdrop), validation/ (schemas, luhn, cardBrand)
    transaction/  transactionSlice, api, components, pages/TransactionStatusPage
  shared/
    api/          baseApi (RTK Query), error normaliser
    gateway/      tokenizeCard client (the only code that sees card data)
    components/   Money, AppShell, ErrorBoundary, ResponsiveImage…
    config/env.ts # the only file that reads import.meta.env
    lib/          formatMoney, pure helpers
  test/           render helpers, MSW handlers, builders
```

## Rules

1. Components render and dispatch. Rules, calculations and async flows live in slices, thunks,
   selectors or `validation/` — all unit-testable without rendering.
2. Server data → RTK Query. Flow/UI state that must survive refresh → `checkout` / `transaction`
   slices. Ephemeral UI state (field focus, open menus) → component state.
3. **Card number, CVC, expiry never enter Redux, localStorage, logs or analytics.** They exist
   only inside `CardForm` (React Hook Form) and the `tokenizeCard` call.
4. Money is integer cents end-to-end; format only at render with `formatMoney`.
5. Totals shown in the summary come from `/payment-config` fees + product price; after payment,
   show the amounts returned by the API (source of truth).
6. Layout with MUI `Stack`/`Box`/`Grid` (flexbox / CSS grid) and theme breakpoints. No fixed
   pixel widths; nothing may overflow at 375 px.
7. Every interactive element has an accessible name; forms have labels and inline errors.
8. Only `shared/config/env.ts` touches `import.meta.env` (keeps Jest simple).
9. Feature folders do not import from each other's internals — only from the feature's `index.ts`.

## Commands (from repo root, once scaffolded)

`npm run dev -w apps/web` · `npm run test -w apps/web` · `npm run test:cov -w apps/web` · `npm run build -w apps/web`
