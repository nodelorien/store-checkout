# Spec 018 — Motion emphasis on wide screens

- Status: Done
- Component(s): frontend
- Branch: `feat/018-motion-emphasis`
- Traces to: NFR-01, NFR-07, PRD §7 (bonus "CSS skills", "Fully responsive, cross-browser")
- Context to load: `docs/components/frontend/CONTEXT.md`, `motion.md`
- Plan and tasks: folded into this file (small follow-up to spec 017)

## 1. Why

Spec 017 was tuned at 375 px. On a desktop the page barely scrolls, so its scroll-driven depth is
almost invisible, and the hero illustration was cropped. The store must feel alive on wide screens
too, without making the phone experience heavier.

## 2. Scope

**In:**
- Larger depth travel: up to 48 px for the deepest hero plane and 16 px for product images.
- Hero: taller on wide screens, illustration always fully visible, and an opening sequence played
  once per page load (discs bloom, the sun spins in, sparks pop in).
- With a mouse, the hero's planes lean towards the pointer and return to rest when it leaves.
- With a mouse, an available product card lifts slightly and its picture moves closer on hover.
- Buttons shrink slightly while pressed.
- Fix: the screen-reader-only "Loading products…" text could widen the page while loading.

**Out:**
- Tilt in 3D, cursor trails, looping decoration, any change on touch devices beyond travel.
- Changes to the checkout dialog, summary or status screen.

This supersedes two limits of spec 017: "no layer travels more than 24 px" (now 48) and
"no pointer-tilt" (flat, mouse-only leaning is allowed on the hero).

## 3. Behaviour

Opening the store plays the hero's sequence once. Moving the mouse over the band shifts the near
plane more than the far one, so the sun appears to float above the discs; the heading does not
move. Hovering an available product raises it; a sold-out product does not react. Nothing in this
spec changes layout size, focus order or what is clickable.

## 4. Acceptance criteria

- **AC-1** — Given a product image, when it drifts, then it travels at most 16 px and overfills
  its frame by the same margin; the deepest hero plane travels at most 48 px.
- **AC-2** — Given a mouse over the hero, when it moves, then the planes receive the pointer
  position from −1 to 1 on each axis (0 at the centre, clamped at the edges), the band's size and
  the heading stay unchanged, and leaving the band returns the planes to rest.
- **AC-3** — Given a mouse, when it hovers a product card, then an available product responds and
  a sold-out product does not.
- **AC-4** — Given the system setting "reduce motion", then the opening sequence, the pointer
  depth, the hover lift and the press feedback do not move anything.
- **AC-5** — Given the product list is loading, then the page is not wider than the viewport.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Touch device | No pointer depth and no hover lift; scroll depth as in spec 017 |
| Mouse leaves the band mid-movement | Planes ease back to rest |
| Band narrower than the illustration | Illustration scales down, anchored right, never cropped |
| Browser without the `translate` property | Planes stay at rest; scroll depth still works |

## 6. Contract changes

None. Motion tokens gain `duration.intro`, `easing.spring`, `distance.lift` and
`parallax.imageTravel`; `parallax.maxTravel` becomes 48.

## 7. Security and privacy notes

None. Pointer position is used only for a visual offset and is never stored or sent.

## 8. Open questions

None.

## 9. Tasks

- [x] T01 Tokens and `ParallaxLayer` `pointer` prop; `usePointerDepth` with tests (AC-2, AC-4)
- [x] T02 Hero: sizing, opening sequence, pointer depth (AC-2)
- [x] T03 Card hover, image travel, button press (AC-1, AC-3)
- [x] T04 Anchor the screen-reader-only text (AC-5 — verified in the browser; jsdom has no layout)
- [x] T90 Lint, typecheck, `test:cov` ≥ 80 %, docs (`motion.md`), browser pass at 1440 and 375 px
