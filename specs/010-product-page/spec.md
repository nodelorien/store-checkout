# Spec 010 — Product page

- Status: Done
- Component(s): frontend
- Branch: `feat/010-product-page`
- Traces to: FR-01, FR-02, NFR-01, NFR-06
- Context to load: `docs/components/frontend/CONTEXT.md`, `ui.md`, `testing.md`, `docs/components/backend/api.md`

## 1. Why

The customer starts here: they must see what is for sale, what it costs, whether it is in stock,
and have one obvious way to start paying.

## 2. Scope

**In:** product grid read from `GET /products`; product card (image, name, description, price,
stock, call to action); loading, empty and error states; six product illustrations; the checkout
notice banner; starting the checkout for a product.

**Out:** the checkout dialog itself (011); quantity selection (011).

## 3. Behaviour

- Products are listed in a responsive grid: one column on phones, more as width allows.
- Each card shows the image (4:3, never shifting layout), name (max 2 lines), description (max 3
  lines), price in COP and stock: "N in stock", "Only N left" (3 or fewer) or "Sold out".
- The button is labelled exactly "Pay with credit card". It is disabled when stock is 0.
  Pressing it selects the product and moves the checkout to the payment-info step.
- While loading, skeleton cards are shown. If the request fails, an alert with a "Retry" button
  is shown. With no products, an empty message is shown.
- Images: the first two load eagerly (first one with high priority), the rest lazily; a skeleton
  shows until the image loads and a placeholder if it fails.
- A checkout notice (for example "this product just sold out") shows above the grid and can be dismissed.

## 4. Acceptance criteria

- **AC-1** — Given the API returns products, then each card shows name, description, formatted price and stock.
- **AC-2** — Given a product with stock 0, then it shows "Sold out" and its button is disabled.
- **AC-3** — Given a product with stock 1, then it shows "Only 1 left" and its button is enabled.
- **AC-4** — When "Pay with credit card" is pressed, then the checkout step becomes `PAYMENT_INFO` for that product.
- **AC-5** — While the request is pending, skeleton placeholders are shown and announced as loading.
- **AC-6** — Given the request fails, then an alert is shown; pressing "Retry" requests again and renders the products.
- **AC-7** — Given an empty list, then an empty-state message is shown.
- **AC-8** — Images have fixed intrinsic dimensions; below-the-fold images are lazy; a skeleton
  shows until load; a failed image shows a labelled placeholder.
- **AC-9** — A checkout notice is displayed and can be dismissed.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Very long product name / description | clamped with ellipsis, never overflows the card |
| Image URL missing or broken | placeholder with the product name as accessible label |
| Stock changes after a purchase | list refetches when the page is shown again |

## 6. Contract changes

None. Product images are SVG served from `/images/products/<slug>.svg` (documented in `ui.md`).

## 7. Security and privacy notes

None: public catalogue data only.

## 8. Plan and tasks (merged)

- [x] T01 Six SVG illustrations in `public/images/products/`
- [x] T02 `ResponsiveImage` (ratio box, skeleton, error fallback, lazy/eager)
- [x] T03 `StockChip`, `ProductCard`, `ProductGrid`, skeleton grid
- [x] T04 `ProductsPage` wiring: query states, notice banner, select product
- [x] T90 lint, typecheck, test:cov green; `ui.md` updated (SVG)
