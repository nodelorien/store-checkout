---
layer: L1
component: system
read-when: planning a feature, writing a spec, or checking whether something is in scope
---

# PRD — Product checkout with card payment

## 1. Context

Technical assessment. Build an app where a customer buys a product from our store paying by
credit card through an external payment gateway (sandbox only, no real money). The source
brief is not stored in this repo; this PRD is the authoritative restatement.

**Goal:** complete, deployed, tested checkout onboarding. **Pass mark:** 100 points (see §7).

## 2. User and journey

Single persona: anonymous shopper on a phone. No login, no cart — one product per purchase.

Five screens, strictly in this order:

1. **Product page** — products with image, name, description, price, units in stock; CTA "Pay with credit card".
2. **Card + delivery** — modal collecting card data and delivery data, validated.
3. **Summary** — backdrop component with product amount + base fee + delivery fee + total, and a "Pay" button.
4. **Final status** — result of the transaction (approved / declined / error / still pending).
5. **Product page** — back to the catalogue showing the updated stock.

## 3. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | List products with description, price and available stock, read from the API. DB seeded with dummy products; no create-product endpoint. |
| FR-02 | "Pay with credit card" opens a modal requesting card data. Disabled when stock is 0. |
| FR-03 | Validate card data: number (Luhn + length), expiry (not in the past), CVC, holder name. Fake but structurally valid cards. |
| FR-04 | Detect and show VISA / MasterCard logo from the card number while typing. |
| FR-05 | Collect delivery data: full name, email, phone, address, city, region, (optional) postal code. Validated. |
| FR-06 | Summary in a backdrop: product amount, base fee (always added), delivery fee, total, pay button. |
| FR-07 | On pay: backend creates a transaction in `PENDING` and returns a transaction number (reference). |
| FR-08 | Backend calls the payment gateway to complete the payment. |
| FR-09 | When the payment resolves: update the transaction with the result, assign the product to the customer (delivery record), update stock. |
| FR-10 | Show the transaction result, then return to the product page with stock refreshed. |
| FR-11 | Refresh resilience: reloading at any step restores the customer's progress (step, product, delivery form, in-flight transaction). |
| FR-12 | API exposes **stock**, transactions, customers and deliveries resources (the brief names these four) using varied, correct HTTP methods and status codes. Stock is addressable explicitly, not only embedded in products. |
| FR-13 | Public API documentation (Swagger URL) linked from the README. |

## 4. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Frontend: SPA in React. Redux mandatory, Flux-aligned. Mobile-first, responsive; minimum viewport iPhone SE (2020): the brief says 1334×750 **device** pixels, i.e. 375×667 CSS px at 2× — design for 375 wide, not 750. Nothing overflows its boundaries. |
| NFR-02 | Backend: NestJS/TypeScript. Business logic outside controllers. Hexagonal architecture (ports & adapters). Use cases written with Railway Oriented Programming. |
| NFR-03 | Unit tests with Jest, **> 80% coverage** on both frontend and backend; results pasted into the README. |
| NFR-04 | Deployed on a cloud provider (AWS), frontend connected to the deployed API, over HTTPS. |
| NFR-05 | Sensitive data handled safely: no card data stored or logged, secrets out of the repo, OWASP-aligned, security headers. |
| NFR-06 | Images render fast (sized, lazy, modern formats, CDN-cached). |
| NFR-07 | Works across current Chrome, Safari, Firefox, Edge. |
| NFR-08 | Infrastructure as code. |
| NFR-09 | README includes: data model design, API docs link, coverage results, deployed URLs, run instructions. |
| NFR-10 | Public GitHub repo, feature branches + PRs, visible commit history. Provider's company name must not appear in the repo. |

## 5. Business rules

- BR-01 Total = `unitPrice × quantity + baseFee + deliveryFee`. All three computed by the backend; the client only displays them.
- BR-02 Base fee and delivery fee are fixed server-side configuration values.
- BR-03 Quantity ≥ 1 and ≤ available stock. Default 1.
- BR-04 Stock can never go negative, even with concurrent purchases.
- BR-05 A transaction ends in exactly one final state; a final state is never overwritten (idempotent resolution).
- BR-06 Stock is only *consumed* by approved transactions and only when the payment resolves (ADR-0011).
- BR-07 A delivery exists only for approved transactions.

## 6. Out of scope

Authentication, multi-item cart, product CRUD, payment methods other than card, refunds/voids,
admin UI, i18n (UI copy in English), real money.

## 7. Scoring (drives prioritisation)

| Points | Item |
|---|---|
| 30 | >80% unit coverage, frontend and backend |
| 20 | Full checkout onboarding working |
| 20 | API working correctly |
| 20 | App + API deployed in the cloud |
| 5 | README complete |
| 5 | Fast images, no out-of-bounds UI |
| bonus 10 ×4 | Hexagonal + ports/adapters · ROP · Clean code · CSS skills |
| bonus 5 ×2 | OWASP + HTTPS + security headers · Fully responsive, cross-browser |

Priority order when time is short: working flow → tests/coverage → deploy → README → bonuses.

## 8. Open questions

- Fee amounts (proposed: base fee COP 2,500; delivery fee COP 8,000) — confirm or adjust.
- Number and theme of seeded products (proposed: 6).
