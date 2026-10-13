# AGENTS.md — L0 context router

Single entry point for every AI coding agent (Claude Code, Codex, opencode).
Keep this file under 80 lines. It routes; it does not explain.

## Project in one paragraph

Mobile-first SPA checkout for a small store: browse a product, pay by credit card through an
external **payment gateway** (sandbox), capture delivery data, show the result, update stock.
Monorepo: `apps/api` (NestJS, hexagonal + ROP, DynamoDB), `apps/web` (React + MUI + Redux Toolkit),
`infra` (AWS CDK). All TypeScript, all tested with Jest (>80% coverage each side).

## Hard rules (always apply)

1. **Never write the payment provider's company name** anywhere in the repo (code, docs, commits,
   branch names, env var names, hostnames). Say "payment gateway" / `PAYMENT_GATEWAY_*`. The gateway's
   URLs contain that name, so they come from env/CI variables only — never hard-coded. Test requirement.
2. **Never commit secrets.** Keys live in `.env` (git-ignored) or AWS SSM. `.env.example` has placeholders only.
3. **Card data (PAN, CVC, expiry) never reaches our API, logs, Redux persistence or localStorage.**
   The browser tokenizes directly with the gateway; only token + brand + last4 travel.
4. **Money is integer cents** (`amountInCents`), currency `COP`. Prices and fees are computed server-side only.
5. **No business logic in controllers or React components.** Backend: use cases. Frontend: slices/thunks/selectors.
6. **Spec first.** No feature code without an approved `specs/NNN-*/spec.md`. See `specs/README.md`.
7. **Jest only** (no Vitest). A task is not done until tests pass and coverage stays ≥ 80%.
8. One feature = one branch (`feat/NNN-slug`) = one PR. Conventional Commits, small and frequent —
   the brief voids repos without visible commit progress. Never squash the history into one commit.
9. **Redux only** for app state (brief mandate). No Zustand, MobX or Context-as-store.
10. **Gateway = sandbox host from the brief, API keys only.** Never the non-sandbox URL, never the
    hosts shown in the provider's public docs, never real cards. Never log into the provider's shared
    dashboard, change its credentials or add MFA.
11. **Mobile baseline is 375×667 CSS px** (the brief's "1334×750" is device pixels). Nothing overflows at 375.
12. **Allowed stack only:** React SPA + NestJS. No Next.js/Remix/other frameworks, no product-creation endpoint.

## Context loading protocol (token budget)

Docs are layered. Load the **lowest layer that answers the question**, never a whole folder.

| Layer | What | Where | When to load |
|---|---|---|---|
| L0 | Router + hard rules | `AGENTS.md` | Always (auto) |
| L1 | Product + system shape | `docs/product/prd.md`, `docs/architecture/overview.md` | Planning, cross-component work |
| L2 | Component entry point | `docs/components/<c>/CONTEXT.md` | Any work inside that component |
| L3 | Component deep dives | `docs/components/<c>/<topic>.md` | Only the topic you are touching |
| L4 | Feature spec | `specs/NNN-*/{spec,plan,tasks}.md` | Only the feature in progress |
| ADR | Why a decision was made | `docs/adr/NNNN-*.md` | Only when questioning/changing a decision |

Rules: read L2 before L3; L2 lists its L3 docs with a one-line "read when". Do not read ADRs to
learn *what* to do (L2/L3 say that) — only to learn *why*. Do not load another component's docs
unless the task crosses the boundary; the contract between components is `docs/components/backend/api.md`.

## Task → context routing

| Task | Skill | Load |
|---|---|---|
| Write / refine a spec, plan a feature | `sdd-workflow` | PRD + `specs/README.md` + relevant L2 |
| API, domain, persistence, gateway | `backend-dev` | `components/backend/CONTEXT.md` + needed L3 |
| UI, state, checkout flow | `frontend-dev` | `components/frontend/CONTEXT.md` + needed L3 |
| Tests, coverage | `qa-testing` | the component's `testing.md` |
| AWS, CI/CD, env config | `infra-deploy` | `components/infra/CONTEXT.md` |
| Review a diff / PR | `reviewer` | spec of the feature + touched component L2 |

Skills live in `.agents/skills/` (`.claude/skills` is a symlink to it). Subagents: `.claude/agents/`,
`.codex/agents/`, `.opencode/agents/` — thin wrappers over the same skills.

## Token savers (on in every session)

Load `ponytail` (smallest change that fully solves the task) and `caveman` (terse chat replies).
The hard rules win over both: spec, a test per AC, coverage and docs are never "extra". Everything
written to the repo (code, comments, commits, docs, specs, PRs) stays in plain full sentences.
Off for a session: "stop ponytail" / "stop caveman". Why: ADR-0014.

## Keeping docs alive

- Changing behaviour → update the L3 doc in the same PR. Changing a decision → new ADR that supersedes the old one.
- Doc size caps: L2 ≤ 80 lines, L3 ≤ 150 lines, ADR ≤ 60 lines. Split instead of growing.
- Never duplicate content across layers; link down.
