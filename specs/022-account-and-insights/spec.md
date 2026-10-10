# Spec 022 — Account menu, My orders and Insights

- Status: Done
- Component(s): backend, frontend
- Branch: `feat/022-account-and-insights`
- Traces to: FR-10, FR-12, NFR-01, NFR-05, NFR-07, PRD §7 (bonus "CSS skills", "Clean code")
- Context to load: `docs/components/backend/api.md`, `docs/components/frontend/CONTEXT.md`, `state.md`, `ui.md`
- Plan and tasks: folded into this file

## 1. Why

After paying, a customer could only reach an order through its link, and nobody could see how the
store was doing. A shop that looks signed-in — avatar, greeting, an account menu — with the
customer's orders and a small set of activity reports makes the product feel complete.

## 2. Scope

**In:**
- Header: the signed-in customer (avatar with initials, greeting) and a menu to the store,
  "My orders" and "Insights". The session is a fixed demo profile; there is no sign-in.
- "My orders": the purchases made from this device, newest first, each with its current status
  and total, linking to its result screen.
- An own order reopened later still shows its delivery address and lets it be corrected (extends
  spec 020, which limited that to the checkout in progress).
- `GET /reports/summary?days=`: aggregate figures of the store's payments for the last N days.
- "Insights": three reports in tabs — Sales (headline figures, revenue per day), Products (top
  five by revenue), Payments (approval rate, outcomes, card brands) — over 7, 14 or 30 days.

**Out:**
- Accounts, sign-in, sign-out, profiles stored on the server.
- Orders made on other devices (the API has no customer session to list them by).
- Per-customer reports, exports, date pickers, comparisons with a previous period.
- Any personal data in the reports endpoint.

## 3. Behaviour

Every payment attempt that reaches the API is remembered on the device by transaction id,
reference and date — nothing else — up to twenty, and survives a reload. "My orders" completes
each entry with its live state from the API.

Insights shows the whole store's activity (not only this device's). Each chart can be switched to
a table with the same numbers. The chosen report and period are kept in the address.

## 4. Acceptance criteria

- **AC-1** — Given any page, then the header shows the demo customer's initials and first name,
  and its menu lists Store, My orders and Insights and says the session is a demo.
- **AC-2** — Given a payment that reached the API, then the device remembers its id, reference and
  date only; newest first, without duplicates, at most twenty; a failed request adds nothing;
  unreadable or malformed stored content is ignored; the list survives a reload.
- **AC-3** — Given "My orders", then each remembered purchase shows product, quantity, total and
  current status and links to its result; with none, an empty state leads to the store; if an
  order's details cannot be read, what the device remembers is still shown.
- **AC-4** — Given an own approved order opened from "My orders", then its address is shown and
  can be edited while pending.
- **AC-5** — Given Insights, then Sales is shown first with revenue, approved orders, average order
  and units, and one column per day; choosing a period asks the API for it; the report and the
  period are in the address and invalid values fall back to Sales and 14 days.
- **AC-6** — Given the Products and Payments reports, then they show the top products with revenue
  and units, the approval rate, a count for each of the five statuses and attempts versus approved
  for each card brand; every chart can be read as a table.
- **AC-7** — Given the reports cannot be read, then an error with a retry is shown; given a period
  without payments, then that is said and the reports render empty.
- **AC-8** — (API) Given `days` 1–90 (default 14), then the summary counts approved payments for
  revenue, orders, units and top products, zero-fills every day (America/Bogota), reports all five
  statuses and both card brands, and returns no personal data; invalid or unknown parameters
  answer 400. Covered by the API's own `AC-n` tests in the reports module.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Storage unavailable or full | Orders are not remembered; nothing breaks |
| Idempotent replay of a payment | Same transaction, listed once |
| More than twenty purchases | The oldest drop off the list (they remain reachable by link) |
| Narrow screen | Charts are drawn at a phone-sized scale so axis text stays legible |
| A status with no payments | Listed with 0, not omitted |

## 6. Contract changes

API: new `GET /reports/summary` (see `api.md`). State: `orders.items[{ id, reference, placedAt }]`,
stored under its own key `orders:v1` through an allow-list. RTK Query: `getSalesSummary`.
Routes: `/orders`, `/insights`.

## 7. Security and privacy notes

- The reports endpoint is public like the rest of this guest store, so it returns aggregates only
  and reads only non-personal attributes from the table. In a store with accounts it would sit
  behind an operator role.
- The device stores ids, references and dates of its own orders: no customer, address or card
  data. The address of an order is shown only where that order is remembered.
- The demo profile is a constant in the web app and is never sent to the API.

## 8. Open questions

None.

## 9. Tasks

- [x] T01 API: reports module — range, aggregation, read port and adapter, controller (AC-8)
- [x] T02 Web: orders slice, storage, listener, bootstrap (AC-2)
- [x] T03 Web: account menu, My orders page, own-order address (AC-1, AC-3, AC-4)
- [x] T04 Web: chart building blocks with table view; validated chart colours
- [x] T05 Web: Insights page with three reports (AC-5, AC-6, AC-7)
- [x] T90 Lint, typecheck, `test:cov` ≥ 80 % in api and web, docs, browser pass on the local stack
