# Spec-driven development

No feature code without an approved spec. One feature = one folder = one branch = one PR.

## Workflow

```
1 SPECIFY   specs/NNN-slug/spec.md    WHAT + acceptance criteria        role: spec-author
2 PLAN      specs/NNN-slug/plan.md    HOW: files, contracts, tests      role: component engineer
3 TASKS     specs/NNN-slug/tasks.md   ordered, test-first checklist     role: component engineer
4 IMPLEMENT code + tests, tick tasks, update L3 docs                    role: backend / frontend / devops
5 VERIFY    lint + typecheck + test:cov (≥ 80%)                         role: qa-engineer
6 REVIEW    diff vs spec + checklists                                   role: reviewer
```

Gates:
- **spec → plan:** every AC is testable, no `[NEEDS CLARIFICATION]` left, status `Approved`.
- **plan → tasks:** plan lists every file to create/change and the contract changes; no conflict with an ADR (or a new ADR is included).
- **tasks → done:** all boxes ticked, each AC maps to at least one named test, coverage ≥ 80%, docs updated.

Small features may merge `plan.md` and `tasks.md` into one file; the spec is never skipped.

## Conventions

- Folder: `specs/NNN-kebab-slug/`, `NNN` zero-padded, sequential. Branch: `feat/NNN-kebab-slug`.
- Requirement ids: PRD `FR-xx` / `NFR-xx` / `BR-xx` → spec `AC-n` → test title prefix `AC-n:`.
- Specs describe behaviour, not implementation. Implementation detail belongs in `plan.md`.
- A spec loads context by reference (`Context: docs/components/backend/domain.md#…`), it does not copy it.
- Status values: `Draft` → `Approved` → `In progress` → `Done`. Update the roadmap table below.
- Commits: Conventional Commits with the spec number as scope, e.g. `feat(003): create transaction use case`.

## Roadmap

Ordered by dependency and by rubric value (PRD §7). Each row becomes a spec folder when started.

| # | Spec | Component | Covers | Status |
|---|---|---|---|---|
| 001 | `project-scaffold` — workspaces, Nest + Vite apps, lint, Jest with 80% gate, docker-compose DynamoDB, CI | all | NFR-03, NFR-10 | Done |
| 002 | `shared-kernel` — `Result`, `DomainError`, error→HTTP mapper, config validation, logging/redaction, health | backend | NFR-02, NFR-05 | Done |
| 003 | `products-catalog-api` — product domain, repository, seed, `GET /products`, Swagger | backend | FR-01, FR-12, FR-13 | Done |
| 004 | `customers-api` — upsert by email, get | backend | FR-12 | Done |
| 005 | `payment-gateway-adapter` — port, HTTP adapter, signature, `GET /payment-config` | backend | FR-08 | Done |
| 006 | `transactions-api` — create (PENDING + charge + poll), get/reconcile, resolve, idempotency | backend | FR-07, FR-08, FR-09, BR-01..06 | Done |
| 007 | `deliveries-api` — created on approval, get, by transaction, amend address | backend | FR-09, FR-12, BR-07 | Done |
| 008 | `gateway-webhook` — checksum-verified event endpoint (optional) | backend | FR-09 | Done |
| 009 | `web-foundation` — store, RTK Query base, theme, router, app shell, persistence middleware | frontend | NFR-01, FR-11 | Done |
| 010 | `product-page` — product grid, stock, images, CTA | frontend | FR-01, FR-02, NFR-06 | Done |
| 011 | `payment-info-step` — checkout dialog, card form + brand detection, delivery form, tokenization | frontend | FR-02..05 | Done |
| 012 | `summary-and-payment` — summary backdrop, confirm payment, error handling | frontend | FR-06, FR-07 | Done |
| 013 | `transaction-status` — status page, polling, back to store, stock refresh | frontend | FR-10 | Done |
| 014 | `refresh-recovery` — resume at every step, token expiry, guards | frontend | FR-11 | Done |
| 015 | `aws-deployment` — CDK stack, security headers, secrets, deploy workflow, seed | infra | NFR-04, NFR-05, NFR-08 | Done |
| 016 | `readme-and-hardening` — README deliverables, coverage report, Observatory, cross-browser pass | all | NFR-09, FR-13 | Done |
| 017 | `motion-and-parallax` — motion tokens, reveal on scroll, hero and image parallax, status and stock feedback | frontend | NFR-01, NFR-06, NFR-07 | Done |
| 018 | `motion-emphasis` — larger travel, hero opening sequence and pointer depth, card hover, wide-screen hero | frontend | NFR-01, NFR-07 | Done |
| 019 | `dark-fintech-redesign` — dark theme, new mark and illustrations, gradient-arc hero, live card preview | frontend | NFR-01, NFR-06, NFR-07 | Done |

Critical path if time runs short: 001 → 002 → 003 → 005 → 006 → 009 → 010 → 011 → 012 → 013 → 015 → 016.
004 and 007 are small and can be folded into 006's PR; 008 is optional; 014 can be partially delivered inside 009/013.

## Templates

`specs/_template/spec.md`, `plan.md`, `tasks.md` — copy the folder, rename, fill in.
