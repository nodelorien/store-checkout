# ADR-0012: Atomic layering of `shared/`, feature folders kept

- Status: Accepted
- Date: 2026-10-10
- Drivers: NFR-01, PRD §7 (clean code, CSS skills)

## Context

The web app is organised by feature (`features/products`, `checkout`, `transaction`) plus a
`shared/` folder, and features may only import each other through their `index.ts`. Spec 017 adds
a motion system and more reusable pieces. Atomic design (atoms → molecules → organisms → templates
→ pages) was considered as the organising principle for the whole app.

The existing components already map onto those levels, but most organisms are feature-specific:
`CardForm`, `CheckoutDialog`, `SummaryBackdrop`, `TransactionStatus`.

## Decision

Apply atomic design only to the reusable layer, and keep feature folders as the top-level split.

- `shared/ui/atoms` — indivisible, no feature knowledge (`Money`, `visuallyHidden`).
- `shared/ui/molecules` — small compositions (`ResponsiveImage`).
- `shared/ui/templates` — page frames (`AppShell`); `shared/ui/pages` — feature-less pages.
- `shared/motion` — the motion vocabulary and its primitives (`Reveal`, `ParallaxLayer`).
- Organisms and pages that know a feature stay in `features/<name>/components|pages`.

A component moves into `shared/ui` only when a second feature needs it.

## Consequences

- Positive: reusable pieces have an obvious home and level; feature boundaries and their lint
  rule are untouched; no state or behaviour moved.
- Negative / cost: two vocabularies coexist (feature and atomic level); the level of a shared
  component is a judgement call.

## Alternatives rejected

- Whole app in `atoms/molecules/organisms/templates/pages` — groups files by size instead of by
  what changes together, breaks the per-feature public API, and moves every file for no visible gain.
- No layering — `shared/components` was already mixing an atom, a molecule, a template and a page.
