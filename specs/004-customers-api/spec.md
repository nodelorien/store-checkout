# Spec 004 — Customers API

- Status: Done
- Component(s): backend
- Branch: `feat/004-customers-api`
- Traces to: FR-12
- Context to load: `docs/components/backend/CONTEXT.md`, `domain.md`, `api.md`, `data-model.md`

## 1. Why

A guest buyer is identified by e-mail; the same person paying twice must be one customer record.

## 2. Scope

**In:** customer domain (`Customer`, `Email`, `Phone`, `FullName`); repository with lookup by
e-mail; `PUT /customers` (idempotent upsert), `GET /customers/:id`.

**Out:** authentication, listing or deleting customers.

## 3. Behaviour

Upserting with a new e-mail creates a customer; upserting again with the same e-mail (any casing
or surrounding spaces) updates name and phone of the same record and keeps its id.

## 4. Acceptance criteria

- **AC-1** — Given an unknown e-mail, when `PUT /customers` is sent, then it answers `201` with `{ data: { id, fullName, email, phone, createdAt, updatedAt } }` and the e-mail is stored lower-cased and trimmed.
- **AC-2** — Given a known e-mail (case-insensitive), when `PUT /customers` is sent, then it answers `200` with the same `id`, updated `fullName` / `phone` / `updatedAt` and unchanged `createdAt`.
- **AC-3** — Given an invalid body (bad e-mail, phone not matching `^\+?[0-9]{7,15}$`, name shorter than 3 or longer than 100, unknown property), the answer is `400` `VALIDATION_ERROR` with field details.
- **AC-4** — Given an existing id, `GET /customers/:id` answers `200` with the customer; an unknown id answers `404` `CUSTOMER_NOT_FOUND`; a non-UUID id answers `400`.
- **AC-5** — Given the data store fails, the answer is `500` `PERSISTENCE_ERROR`.
- **AC-6** — `Email`, `Phone` and `FullName` reject invalid values on their own (domain validation does not depend on the DTO).
- **AC-7** — Customer responses carry `Cache-Control: no-store`.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Two simultaneous first upserts with the same e-mail | both succeed; a duplicate record may exist (accepted, documented; lookup returns the oldest) |
| Phone with spaces or dashes | separators are removed before validation |

## 6. Contract changes

Response shape of the customer resource made explicit in `api.md`.

## 7. Security and privacy notes

E-mail, phone and name are personal data: never logged, responses are `no-store`.

## 8. Plan and tasks (merged)

- [x] T01 Domain value objects and `Customer` + tests
- [x] T02 Port, `UpsertCustomer`, `GetCustomer` + tests with in-memory fake
- [x] T03 `DynamoDbCustomerRepository` (`byEmail` GSI) + tests
- [x] T04 DTO, controller, module + supertest tests
- [x] T90 lint, typecheck, test:cov green
