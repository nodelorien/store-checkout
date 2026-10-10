# Spec 019 — Dark fintech redesign

- Status: Done
- Component(s): frontend (plus the seed's image paths)
- Branch: `feat/019-dark-fintech-redesign`
- Traces to: NFR-01, NFR-06, NFR-07, PRD §7 ("Fast images, no out-of-bounds UI", bonus "CSS skills")
- Context to load: `docs/components/frontend/CONTEXT.md`, `ui.md`, `motion.md`
- Plan and tasks: folded into this file

## 1. Why

The first visual pass read as playful: light pastel cards, a cartoon sun, flat illustrations. The
owner asked for the look of a modern finance app — dark, sober, precise — with clean, futuristic
product imagery and widgets such as a live payment card, using three reference boards.

## 2. Scope

**In:**
- Dark theme: near-black background, layered dark surfaces separated by hairlines, one
  violet-to-blue accent, a geometric typeface served from our own origin, pill-shaped buttons.
- New logo mark (an open orbit with a point of light) and browser icon.
- Hero rebuilt as a dark panel crossed by two gradient arcs, keeping the depth of specs 017/018.
- Six new product illustrations in one visual system: dark stage, soft halo, thin luminous lines.
- A live card preview in the checkout: a card that mirrors the number, holder and expiry as typed.
- Header, product cards, dialog, summary and status screens restyled through the theme.

**Out:**
- Any change to the checkout steps, copy of actions, validation, API or state.
- A light theme or a theme switcher.
- Charts or dashboards from the references that have no data behind them in this product.

## 3. Behaviour

Every screen uses the dark theme. While the customer types the card, the preview fills in the
digits typed so far (the rest stay as placeholders), the holder's name and the expiry, and shows
the detected brand. The preview is a picture: the labelled fields remain the only inputs.

Product images moved to a new path because the old files are cached as immutable for a year in
browsers and at the CDN; the seed now points at the new path.

## 4. Acceptance criteria

- **AC-1** — Given any screen, then text and controls keep a contrast of at least 4.5:1 against
  their surface, including white text on primary buttons.
- **AC-2** — Given the seeded catalogue, then every product image path is under
  `/images/catalog/` and a file exists for each.
- **AC-3** — Given the card form, when nothing is typed, then the preview shows sixteen
  placeholders in groups of four, "Your name" and "MM/YY"; as fields are typed it mirrors them.
- **AC-4** — Given the card form, then the preview never shows the security code and is hidden
  from assistive technology.
- **AC-5** — Given 375 px and 1440 px viewports, then no screen scrolls horizontally and the card
  preview fits its container.

## 5. Edge cases and failure modes

| Case | Expected behaviour |
|---|---|
| Font file fails to load | System font stack; layout unchanged (`font-display: swap`) |
| Card number longer than 16 digits or with letters | Preview shows the first 16 digits only |
| Very long holder name | Truncated with an ellipsis inside the card |
| Unsupported card brand | Preview shows the neutral brand placeholder; the field shows its warning |
| Sold-out product | Image desaturated, button disabled, as before |
| Customer returns with the old page cached | New `index.html` is always revalidated; images load from the new path |

## 6. Contract changes

`imageUrl` values in the seed change from `/images/products/<slug>.svg` to
`/images/catalog/<slug>.svg`; the deployed table must be re-seeded (this resets stock). One new
runtime dependency: the self-hosted font package. No API shape, state or env var changes.

## 7. Security and privacy notes

The card preview reads the same in-memory form values as the inputs and renders them only; it
never reads the CVC and nothing is dispatched, persisted or logged. The font is served from our
own origin, so the Content-Security-Policy is unchanged.

## 8. Open questions

None.

## 9. Tasks

- [x] T01 Dark palette, typography, button and surface overrides in the theme (AC-1)
- [x] T02 Logo mark, browser icon, translucent header
- [x] T03 Six illustrations under `public/images/catalog`; seed paths and seed test (AC-2)
- [x] T04 Hero with gradient arcs
- [x] T05 Test + implement: `previewCardNumber`, `CardPreview` (AC-3, AC-4)
- [x] T90 Lint, typecheck, `test:cov` ≥ 80 % in web and api, docs, browser pass at 1440 and 375 px (AC-5)
