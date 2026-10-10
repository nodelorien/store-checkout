---
layer: L3
component: frontend
read-when: adding or changing an animation, transition, parallax layer or scroll-linked style
---

# Motion (`shared/motion`)

One vocabulary for everything that moves. Import from `@/shared/motion`; never hand-write a
duration, easing or scroll listener in a component.

## Rules

1. Animate **only `transform` and `opacity`**. Never width, height, top, margin or box-shadow
   (put the shadow on a pseudo-element and animate its opacity, as `AppShell` does).
2. Content is always in the document and operable. Motion changes presentation, never
   availability: nothing may be hidden unless `useReveal` reports `pending`.
3. `prefers-reduced-motion: reduce` → no depth, no entrances, no icon animation. The primitives
   handle it; the global rule in `app/theme.ts` covers plain CSS transitions.
4. No parallax in the checkout dialog, the summary backdrop or the status screen.
5. No animation library, no scroll-jacking, no looping decoration.
6. Hover and pointer effects are gated by `(hover: hover)` or mouse events, so touch screens
   never get a stuck hover state.

## Tokens (`tokens.ts`)

| Token | Value | Use |
|---|---|---|
| `duration.feedback` / `standard` | 160 / 250 ms | hover, press, toggles (the theme reads these) |
| `duration.enter` / `emphasis` | 360 / 400 ms | entrances, result icon |
| `duration.highlight` | 600 ms | one-off attention (stock changed) |
| `duration.intro` | 700 ms | hero opening sequence, once per page load |
| `easing.standard` / `decelerate` / `spring` | cubic-bezier | movement / entrances / playful one-offs |
| `distance.rise` / `nudge` / `lift` | 12 / 4 / 6 px | fade-and-rise, failure nudge, card hover |
| `stagger.step` / `maxItems` | 50 ms / 6 | siblings entering together |
| `parallax.maxTravel` / `imageTravel` | 48 / 16 px | deepest layer (nothing travels further) / product images |

## Primitives

| Primitive | What it does |
|---|---|
| `Reveal` / `useReveal` + `revealSx` | Fade-and-rise once, the first time the element enters the viewport. States: `static` (no observer or reduced motion — shown at once), `pending`, `shown`. `index` staggers siblings |
| `ParallaxLayer` | Vertical drift for depth. `timeline="view"`: 0 at the middle of the viewport, ±`travel` at the edges (images). `timeline="scroll"`: 0 at the top of the page, +`travel` after `range` px (hero) |
| `usePointerDepth()` | Mouse-only depth: writes the pointer position over an element (−1…1) into `--pointer-x/y`, once per frame; layers opt in with `ParallaxLayer pointer={px}`, which uses the `translate` property so it composes with the scroll drift |
| `useScrollProgress(name, range)` | Fallback half of a scroll-linked style: writes 0–1 into a CSS variable |
| `useChangeCount(value)` | Counts changes of a value while mounted; key an animation on it |
| `clipWithoutScrolling` | `overflow: clip` with a `hidden` fallback |

## How depth is driven

- **Native** (`CSS.supports('animation-timeline: view()')`): keyframes bound to a scroll or view
  timeline, declared under `@media (prefers-reduced-motion: no-preference)` and `@supports`. No
  JavaScript runs while scrolling.
- **Fallback** (Firefox today): `scrollFrames` — one passive `scroll` listener for the page,
  coalesced to one update per animation frame, attached only while a layer is mounted. It writes
  the same offsets, computed by the pure functions in `parallax.ts`.
- **Off**: reduced motion. Layers render with no transform.

A `view()` timeline tracks the **nearest scroll container**, and `overflow: hidden` creates one.
Every clipping ancestor of a `timeline="view"` layer must therefore use `clipWithoutScrolling`
(`ResponsiveImage`'s frame and `ProductCard` do); otherwise the layer silently stops moving.

A layer must overfill its frame by its own travel (`inset: -travel px 0`) so drifting never
uncovers an edge; `ResponsiveImage parallax={n}` does this for images.

## Where motion is used

| Screen | Motion |
|---|---|
| Product page | `StoreHero` (gradient arcs: far 48 px, near 24 px, text still; opening sequence; planes lean to the mouse) · image drift 16 px · cards revealed in rows of three, lift on hover unless sold out · stock chip highlight |
| Checkout dialog / summary | section and row reveals; the sheet slides up (MUI `Slide`) |
| Status | card reveal; approved check is drawn, failure icon nudges once; pending keeps its spinner |
| Every page | brand bar gains a shadow after 32 px of scroll · buttons shrink slightly while pressed |

## Testing

`src/test/motion.ts` provides `mockReducedMotion`, `mockScrollTimelineSupport`,
`installViewportObserver` and `controlScrollFrames`. jsdom has neither `IntersectionObserver` nor
`CSS.supports`, so by default tests run with reveals `static` and depth in `fallback` mode. Assert
on `data-reveal`, `data-parallax`, `data-motion` and inline transforms — not on computed CSS.
Headless browsers report `hover: none`; to check hover effects in Firefox set the prefs
`ui.primaryPointerCapabilities` and `ui.allPointerCapabilities` to `6`.
