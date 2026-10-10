---
name: reviewer
description: Review checklist for this repo covering spec conformance, hexagonal boundaries, ROP, Redux/Flux rules, security (OWASP, card data, secrets), tests and docs. Use when reviewing a diff, branch or pull request, or as a self-review before opening a PR.
---

# Reviewer (spec conformance · architecture · security)

Read-only role: report findings, do not rewrite the change. Review against the **spec**, not taste.

## Load

1. The diff (`git diff main...HEAD`) — read it fully first.
2. The feature's `spec.md` (acceptance criteria) and `plan.md`.
3. The `CONTEXT.md` of each component touched; an L3 doc only to verify a specific rule.

## Checklist

### 1. Spec conformance
- Every `AC-n` implemented and covered by a test titled `AC-n: …` that really asserts it.
- Nothing outside the spec's scope (scope creep) — flag it.
- Contract changes match `docs/components/backend/api.md`; web types match the API.

### 2. Repo hard rules (blockers)
- The payment provider's company name appears nowhere (code, docs, tests, assets, commit messages).
  Check with a case-insensitive search of the diff.
- No secrets, keys or real credentials; `.env` not committed.
- No card number / CVC / expiry in API DTOs, logs, Redux, localStorage, URLs or test fixtures
  beyond documented sandbox numbers inside form tests.
- App state uses Redux only; tests use Jest only; no framework outside React SPA + NestJS.
- Gateway base URL, hostnames and keys come from env — none hard-coded, none pointing to a
  non-sandbox host or to the hosts in the provider's public docs.
- Layout targets 375 CSS px wide (not 750).
- The four brief resources exist in the API: stock, transactions, customers, deliveries.
- The branch has several meaningful commits, not one squashed commit.

### 3. Backend
- Dependency direction respected; no Nest/AWS/HTTP imports in `domain/` or `application/` (ports excepted).
- Use cases return `Result`; no `throw`/`try-catch` for expected failures; every error branch mapped to HTTP.
- Controllers contain no business logic.
- Amounts computed server-side from stored data; stock changed only via conditional atomic writes.
- Resolution is idempotent; stock changes only when a payment is approved (ADR-0011).
- Correct HTTP semantics: verbs, status codes, error envelope, `no-store` on sensitive resources.
- Input validated and whitelisted; body limit, rate limit, helmet in place; errors leak no internals.

### 4. Frontend
- No business logic or fetching inside components; state via slices/RTK Query; memoised selectors.
- Persistence allow-list unchanged or consciously extended (and tested).
- Works at 375 px: no overflow, readable, reachable primary action; loading/empty/error states exist.
- Accessible names, labels, error announcements; images sized and lazy.
- "Pay" cannot be double-submitted.

### 5. Infra
- No hand-made resources, no wildcard IAM, no public bucket, no paid resources without ADR.
- Security headers intact; API paths excluded from SPA fallback.

### 6. Tests and quality
- Coverage ≥ 80% per workspace and not achieved through exclusions or ignore comments.
- Tests are deterministic (no real time, network or randomness).
- Clean code: intention-revealing names, small functions, no dead code, no commented-out code,
  no unexplained `any` / `eslint-disable`.

### 7. Docs
- L2/L3 docs updated for behaviour changes; new decision → new ADR; roadmap status updated.
- Docs stay within size caps and do not duplicate other layers.

## Output format

```
Verdict: APPROVE | REQUEST CHANGES

Blockers
- path:line — problem — why it matters — suggested fix

Should fix
- …

Nits
- …

AC coverage
- AC-1 ✅ test: <title>
- AC-2 ❌ missing
```

Order findings by severity. Cite `path:line`. If nothing is wrong, say so plainly.
