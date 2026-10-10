# Spec 002 — Shared kernel

- Status: Done
- Component(s): backend
- Branch: `feat/002-shared-kernel`
- Traces to: NFR-02, NFR-05
- Context to load: `docs/components/backend/CONTEXT.md`, `api.md` (error envelope, HTTP hygiene)

## 1. Why

Every feature module needs the same building blocks: a `Result` type for railway-oriented use
cases, one error vocabulary with a single HTTP mapping, validated configuration and safe logging.

## 2. Scope

**In:** `Result` / `ResultAsync` combinators; `DomainError` and its HTTP status mapping; the error
envelope for every failure (domain, validation, not found, rate limit, unexpected); configuration
validated at boot (secrets from env or SSM parameter names); request id; request logging with
redaction; rate limiting; body size limit; `Cache-Control` policy; `Clock` / `IdGenerator` ports;
DynamoDB document client provider; Lambda entry point.

**Out:** any business endpoint (specs 003+).

## 3. Behaviour

Every response carries `X-Request-Id` (echoed when the caller sends a well-formed one, generated
otherwise). Every failure is rendered as `{ error: { code, message, details, requestId } }`.
Unexpected failures never leak internals. The process refuses to start with an invalid configuration.

## 4. Acceptance criteria

- **AC-1** — `Result` and `ResultAsync` combinators (`map`, `mapErr`, `andThen`, `orElse`, `match`) behave correctly on both tracks and short-circuit on the error track.
- **AC-2** — Every `DomainError` code maps to the HTTP status listed in `api.md`.
- **AC-3** — Given an unknown route, a malformed body or an unexpected exception, the response uses the error envelope with the request id; a 500 carries a generic message only.
- **AC-4** — Given a request with a well-formed `X-Request-Id`, the same value is echoed; otherwise a UUID is generated.
- **AC-5** — Given missing or malformed environment values, configuration loading fails listing every problem; no secret value appears in the message.
- **AC-6** — Given a gateway secret absent from env but with a `*_PARAM` name, its value is read from SSM (decrypted); an env value wins over the parameter.
- **AC-7** — The redaction helper masks card tokens, keys, secrets, signatures, emails, phones, names and addresses, at any depth.
- **AC-8** — More than 60 requests per minute from one client are answered `429` with the error envelope.
- **AC-9** — A JSON body larger than 10 kb is answered `413` with the error envelope.
- **AC-10** — Responses under `/transactions`, `/customers`, `/deliveries`, `/payment-config` and `/webhooks` carry `Cache-Control: no-store`; `/products` carries `max-age=0, must-revalidate`.
- **AC-11** — Swagger UI is served at `/api/docs` with a CSP that allows its inline assets; every other path keeps the strict default CSP.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| `X-Request-Id` with unsafe characters or > 128 chars | ignored, a new id is generated |
| SSM unreachable at boot | boot fails with a configuration error |
| events secret missing | allowed (the webhook then rejects every event) |

## 6. Contract changes

Additional error codes not in the original table: `NOT_FOUND` (404, unknown route),
`BAD_REQUEST` (400, malformed JSON), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429),
`INTERNAL_ERROR` (500). Env: `*_PARAM` variants for the three gateway secrets, `TRUST_PROXY`.

## 7. Security and privacy notes

Logs carry method, path, status, duration and request id only; bodies are never logged. Secrets
are never echoed in configuration errors.

## 8. Plan and tasks (merged)

- [x] T01 `shared/result` + tests
- [x] T02 `shared/errors` (codes, factories, HTTP mapping) + tests
- [x] T03 `shared/config` (env schema, SSM secret loader) + tests
- [x] T04 `shared/http` (request id, exception filter, logging, redaction, cache policy, responder) + tests
- [x] T05 `shared/ports` (clock, id generator) + system adapters; DynamoDB client provider
- [x] T06 `bootstrap.ts` hardening (helmet/CSP, throttler, body limit), `lambda.ts`
- [x] T90 lint, typecheck, test:cov green
