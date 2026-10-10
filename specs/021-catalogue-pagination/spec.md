# Spec 021 — Catalogue: more products, paging, search and order

- Status: Done
- Component(s): backend, frontend
- Branch: `feat/021-catalogue-pagination`
- Traces to: FR-01, FR-12, NFR-01, NFR-06, NFR-07
- Context to load: `docs/components/backend/api.md`, `docs/components/frontend/CONTEXT.md`, `ui.md`, `state.md`
- Plan and tasks: folded into this file

## 1. Why

Six products fit on one screen, so the store never had to behave like a catalogue. With eighteen
it must: the customer needs to find a product, and the list must load in pieces — by scrolling on
a phone, by page number on a desk.

## 2. Scope

**In:**
- Seed grows from 6 to 18 products (supersedes "exactly six" in spec 003 AC-9); twelve new
  illustrations in the existing visual system.
- `GET /products` accepts optional `page`, `pageSize`, `search` and `sort`, and always answers
  with `meta` (page, page size, total, total pages). Without parameters it answers as before.
- Product page: search box, order selector, result count.
- Phones: six products at a time; the next page is appended when the end of the list scrolls into
  view, or with a "Load more products" button.
- Wide screens (`md` and up): eight products per page with numbered pages.
- The view (search, order, page) lives in the address bar, so it survives a reload and a link.

**Out:**
- Creating, editing or deleting products (hard rule 12).
- Categories, filters by price or stock, saved searches.
- Database-level paging: the API pages in memory over a catalogue of this size (see `data-model.md`).

## 3. Behaviour

Typing in the search box filters by name or description after a short pause; choosing an order
re-sorts. Both start again from the first page. With no match the page says so and offers to
clear the search. Loading, empty and error states work as before; a later page that fails keeps
the products already shown and can be retried on its own.

The checkout still needs any product by id, so the page also keeps the whole catalogue in the
cache. If that read fails, buying would not work: the list is replaced by the error until a retry
succeeds.

## 4. Acceptance criteria

- **AC-1** — Given a phone, then the first six products are shown; the next six are appended by
  the button or when the end of the list enters the viewport; nothing more is offered after the
  last page.
- **AC-2** — Given a wide screen, then eight products are shown with numbered pages; choosing a
  number shows that page and records it in the address; a page past the end goes to the last one.
- **AC-3** — Given a search, then the API is asked once per pause in typing, the number of results
  is shown and announced, paging restarts at page 1; without matches an empty state offers to
  clear the search.
- **AC-4** — Given an order (featured, name, price ascending or descending), then the API is asked
  for it and it is kept in the address; opening an address with a view shows that view; invalid
  values fall back to the default.
- **AC-5** — Given a failed request, then the first page shows the error with a retry; a later
  page shows it in place, keeping earlier products; an answer without `meta` is treated as the
  whole catalogue in one page.
- **AC-6** — Given a product on any page, then it can be bought.
- **AC-7** — (API) Given `page`, `pageSize`, `search`, `sort`, then the answer is filtered,
  ordered and sliced with a correct `meta`; invalid or unknown parameters answer 400; a page past
  the end answers an empty list. Covered by the API's own `AC-n` tests in the products module.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Browser cannot observe the viewport | The "Load more products" button is the only way; it always works |
| Search or order changes on a phone | The endless list starts again from its first page |
| Reload on page 3 (wide screen) | Page 3 is shown again |
| Stock changes after a purchase | Pages are re-read when the store is shown again |
| Search longer than 60 characters | Cut at 60, as the API requires |

## 6. Contract changes

`GET /products`: optional `page` (≥ 1), `pageSize` (1–48), `search` (≤ 60), `sort`
(`name` default · `featured` · `price-asc` · `price-desc`); response gains `meta`. Seed: 18
products. Web state: RTK Query endpoint `getProductsPage`; the catalogue view is in the URL
(`?q=&sort=&page=`), not in the store.

## 7. Security and privacy notes

Query parameters are validated and whitelisted by the API; the search is matched in memory, never
interpolated into a database expression. No personal data involved.

## 8. Open questions

None.

## 9. Tasks

- [x] T01 API: catalogue query (validation, search, order, slice), `meta`, Swagger, tests (AC-7)
- [x] T02 Seed: twelve products, ids, tests; twelve illustrations
- [x] T03 Web: page endpoint, view in the address bar, toolbar (AC-3, AC-4)
- [x] T04 Web: endless and numbered modes, states (AC-1, AC-2, AC-5, AC-6)
- [x] T90 Lint, typecheck, `test:cov` ≥ 80 % in api and web, docs, re-seed after deploy
