# Spec 017 — Motion system and parallax

- Status: Done
- Component(s): frontend
- Branch: `feat/017-motion-and-parallax`
- Traces to: NFR-01, NFR-06, NFR-07, PRD §7 (bonus "CSS skills", "Fast images, no out-of-bounds UI")
- Context to load: `docs/components/frontend/CONTEXT.md`, `ui.md`, `motion.md`

## 1. Why

The store works but feels static: the only motion is the summary sheet sliding up. A small,
consistent motion language — with depth on the product page — makes the five screens read as one
product and shows CSS craft, without slowing the checkout or excluding anyone.

## 2. Scope

**In:**
- One motion vocabulary (durations, easings, distances) shared by every animated element.
- Product page: a hero band with three depth layers that drift at different speeds while the
  page scrolls, and a slight drift of each product image inside its fixed 4:3 frame.
- The brand bar gains a shadow once the page has scrolled.
- Product cards, form sections and summary rows appear with a short staggered fade-and-rise the
  first time they enter the viewport.
- Final status screen: the result icon draws in once (approved), or settles with a single short
  nudge (declined / error); the pending state keeps its progress indicator.
- Back on the product page after a purchase, the stock label of the purchased product is
  highlighted once when its value changed.
- The status card fades in when its page opens.
- `shared/` is layered as a small design system (atoms, molecules, templates, pages) next to a
  motion module; feature folders keep their components (ADR-0012).

**Out:**
- No parallax inside the checkout dialog, the summary backdrop or the status screen: those are
  task screens, and motion there competes with the form and the pay button.
- No animation library and no new runtime dependency (bundle is already 246 kB gzipped).
- No pointer-tilt, scroll-jacking, smooth-scroll override, auto-playing loops or video.
- No change to the checkout steps, the copy, the API or the persisted state.
- Reorganising feature components into atomic-design folders (ADR-0012 explains why).
- Cross-fading between routes with the View Transitions API: the router runs in declarative
  mode, where that integration is not available.

Defaults chosen (not behaviour-changing for the checkout):
- Depth uses native CSS scroll-driven animation where the browser has it and a passive,
  frame-throttled scroll fallback elsewhere (Firefox does not enable it by default today).
- Entrances may last up to 400 ms and one-off highlights up to 600 ms; interactive feedback
  stays ≤ 250 ms (`ui.md` is amended).
- Only `transform` and `opacity` are animated; no layer travels more than 24 px.
- The hero is an illustrated band above the product list, built from inline shapes in the brand
  colours, with the page heading inside it.

## 3. Behaviour

While the customer scrolls the product page, the hero's background shapes move slowest, its
illustration layer a little faster and the heading at normal page speed, so the band appears to
have depth. Each product image shifts by a few pixels inside its frame as its card crosses the
viewport; the frame itself never moves or resizes. Content further down the page fades and rises
into place once, in reading order, and never animates again on later scrolls.

Everything is readable and operable before, during and without any animation: content is in the
document from the first render, focus order is unchanged, and the "Pay with credit card" button is
never delayed by an entrance. A customer who asked their system to reduce motion gets the same
page with no depth movement, no entrances and no icon animation — only instant state changes.

## 4. Acceptance criteria

- **AC-1** — Given the system setting "reduce motion" is on, when any screen renders or scrolls,
  then no element moves or fades in: depth layers have no offset and revealed content is shown at once.
- **AC-2** — Given a section below the fold, when it enters the viewport for the first time, then
  it switches to its shown state once, in reading order with a stagger of at most 60 ms per item
  and at most 6 staggered items; scrolling away and back does not replay it.
- **AC-3** — Given a browser that cannot observe viewport entry, when the page renders, then all
  content is shown immediately with no hidden state.
- **AC-4** — Given a depth layer and a scroll progress from 0 to 1, when its offset is computed,
  then it is 0 at the middle of the range, proportional to the layer's depth, and never exceeds
  the layer's maximum travel, including for progress values outside 0–1.
- **AC-5** — Given a product image, when it drifts, then its offset never exceeds the margin by
  which the image overfills its frame, so no empty band appears and nothing leaves the card.
- **AC-6** — Given the hero band, when it renders, then its decorative layers are hidden from
  assistive technology, the page heading stays a heading, and the band's height does not depend
  on scroll position.
- **AC-7** — Given a browser without native scroll-driven animation and with motion allowed,
  when the product page mounts, then exactly one passive scroll listener is active, it updates at
  most once per frame, and it is removed when the page unmounts; with native support or reduced
  motion, no listener is attached.
- **AC-8** — Given the product page is showing a product, when a refresh of the list brings a
  different stock for it (as happens on returning from an approved payment), then its stock
  label is highlighted once and the new value is announced politely; unchanged products are not.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Refresh mid-scroll or restored scroll position | Content already in view is shown without a delayed entrance |
| Product list loading, empty or failed | Skeleton, empty and error states are unchanged and not animated in |
| Sold-out product | Same motion as the others; its disabled button stays disabled |
| Viewport 320–375 px wide | No horizontal scroll; layers move vertically only and stay clipped by their frame |
| Very long page / fast fling | Offsets stay clamped; nothing is laid out again per frame |
| Summary backdrop or dialog open | Product page behind it does not animate (scroll is locked) |
| Status changes PENDING → APPROVED while visible | Icon animation plays once, on the final status only |
| Product list was not cached when the page opened | Stock appears without a highlight (there was no earlier value on screen) |

## 6. Contract changes

None for the API, the Redux state shape or env vars. A motion tokens module is the single source
of durations (the theme reads them from it); the rules live in the new L3 `motion.md`.

## 7. Security and privacy notes

None. No new origin, script or dependency: the Content-Security-Policy stays as deployed. No card
field is animated or observed.

## 8. Open questions

None. Approved on 2026-10-10 with the recommended options: atomic layering of `shared/` only,
and the illustrated hero band.
