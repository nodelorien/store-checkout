# Plan and tasks 017 — Motion system and parallax

- Spec: `./spec.md`
- ADRs relied on: 0005, 0009 — new ADR needed? yes: 0012 (atomic layering of `shared/`)

## 1. Approach

All motion goes through one module, `shared/motion`: tokens, pure depth maths, a reveal-on-enter
primitive and a parallax layer. Depth is progressive: where the browser has scroll-driven
animation the layer is animated by CSS on the compositor; elsewhere a single passive scroll
listener, coalesced per frame, writes the same offsets. Reduced motion switches both off and makes
reveals static. Nothing is hidden unless the browser can observe the viewport, so content can
never stay invisible. No state, API or dependency changes.

## 2. Design

| Kind | Element | New / changed | Notes |
|---|---|---|---|
| tokens | `shared/motion/tokens` | new | durations, easings, distances, stagger, travel limits |
| pure logic | `shared/motion/parallax` | new | `viewProgress`, `viewOffset`, `scrollOffset`, `layerTravel`, `staggerDelay` |
| fallback | `shared/motion/scrollFrames` | new | one passive listener, one update per frame, detached when unused |
| primitive | `ParallaxLayer`, `Reveal` / `useReveal` | new | CSS-first; fallback and reduced motion handled inside |
| hook | `useChangeCount`, `useScrollProgress` | new | stock highlight; header shadow |
| component | `StoreHero` | new | three planes; decorative layers `aria-hidden` |
| component | `ResponsiveImage` (`parallax`), `ProductCard`, `ProductGrid`, `StockChip` | changed | image drift, staggered cards, stock highlight |
| component | `FormSection`, `SummaryRow`, `TransactionStatus`, `AppShell` | changed | reveals, drawn check / nudge, scroll shadow |
| structure | `shared/components` → `shared/ui/{atoms,molecules,templates,pages}` | moved | ADR-0012 |

## 3. AC → test

| AC | Test file |
|---|---|
| AC-1 | `Reveal.test`, `ParallaxLayer.test`, `statusContent.test` |
| AC-2, AC-3 | `Reveal.test`, `parallax.test` (stagger) |
| AC-4 | `parallax.test` |
| AC-5 | `parallax.test`, `ParallaxLayer.test`, `ResponsiveImage.test` |
| AC-6 | `StoreHero.test` |
| AC-7 | `scrollFrames.test`, `ParallaxLayer.test` |
| AC-8 | `StockChip.test` |

## 4. Tasks

- [x] T01 Branch `feat/017-motion-and-parallax`; spec approved; roadmap row added
- [x] T02 Move `shared/components` into `shared/ui` levels; update imports (ADR-0012)
- [x] T03 Test + implement: motion tokens and depth maths (AC-2, AC-4, AC-5)
- [x] T04 Test + implement: scroll fallback (AC-7)
- [x] T05 Test + implement: `Reveal`, `ParallaxLayer`, environment hooks (AC-1, AC-2, AC-3, AC-7)
- [x] T06 Test + implement: `StoreHero` on the product page (AC-6)
- [x] T07 Image drift, staggered cards, clipping without scroll containers (AC-5)
- [x] T08 Test + implement: stock highlight (AC-8)
- [x] T09 Reveals in form sections and summary rows; status icon motion; header shadow (AC-1)

## 5. Verification

- [x] T90 `npm run lint && npm run typecheck` clean
- [x] T91 `npm run test:cov` — coverage ≥ 80% in `apps/web`
- [x] T92 Every AC has a passing test titled `AC-n: …`
- [x] T93 Docs: `frontend/motion.md` (new), `frontend/CONTEXT.md`, `frontend/ui.md`, ADR-0012, roadmap
- [x] T94 Browser pass at 375 px: Firefox (fallback path) and Chromium (native path), with and
      without reduced motion
