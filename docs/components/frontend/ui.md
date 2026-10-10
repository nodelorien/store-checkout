---
layer: L3
component: frontend
read-when: building or styling components, changing the theme, responsive behaviour or images
---

# UI guidelines

## Targets

- Minimum viewport **375×667** (iPhone SE 2020). Verify every screen at 375, 414, 768, 1280.
- Browsers: current Chrome, Safari (incl. iOS), Firefox, Edge.
- No horizontal scroll, no clipped text, no element outside its container at any width ≥ 320.

## Theme (`app/theme.ts`)

- MUI `createTheme` with a custom palette (own brand — do not imitate the gateway's branding),
  `shape.borderRadius: 12`, typography scale tuned for mobile (`body1` 16 px minimum to avoid iOS input zoom).
- Use theme tokens only: `theme.spacing`, `theme.palette`, `theme.breakpoints`. No hard-coded hex or px in components.
- Styling via the `sx` prop or `styled()`; layout with `Stack`, `Box`, and CSS Grid (`display: 'grid'`).
- Support `prefers-reduced-motion`; keep transitions ≤ 250 ms.

## Layout rules

- Mobile-first: base styles are for xs; add `sm`/`md` overrides upward.
- Product list: CSS grid `repeat(auto-fill, minmax(260px, 1fr))` → 1 column on phones, more on wider screens.
- Page container: `max-width: 1200px`, side padding `theme.spacing(2)` on xs.
- Touch targets ≥ 44×44 px. Primary action is full-width on xs and sits at the bottom of dialogs/sheets.
- Respect safe areas: `padding-bottom: env(safe-area-inset-bottom)` on bottom sheets.
- Long text: `overflow-wrap: anywhere`; product names clamp to 2 lines.

## Key components

| Component | MUI base | Notes |
|---|---|---|
| `ProductCard` | `Card` | image (fixed aspect ratio), name, description, price, stock chip, CTA. Stock 0 → "Sold out", CTA disabled |
| `CheckoutDialog` | `Dialog` | `fullScreen` below `sm`; scrollable content, sticky actions; order line with quantity stepper, sections "Card details" and "Delivery details", terms checkbox |
| `CardForm` | `TextField` | `inputMode="numeric"`, `autoComplete="cc-number|cc-exp|cc-csc|cc-name"`, brand logo as end adornment (`CardBrandLogo`: the only component with literal colours — the card schemes' own) |
| `DeliveryForm` | `TextField` | `autoComplete` tokens `name`, `email`, `tel`, `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code` |
| `SummaryBackdrop` | `Backdrop` + `Slide` + `Paper` | bottom sheet (centred card from `sm`) rendered **inside** the `Backdrop`, over the dimmed product page; a `Modal` without its own backdrop wraps it only for portal, focus trap, scroll lock and `Esc`; rows: product, base fee, delivery fee, total; "Pay $X" button; dismissed by backdrop click / `Esc` only when not paying |
| `TransactionStatus` | `Paper` | icon + title + reference + amounts; see `checkout-flow.md` |
| `Money` | — | `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })` from cents |

The summary **must** be a backdrop component (brief requirement, Material "Backdrop" reference).

## Images (rubric: "render fast, no out-of-bounds")

- Ship hand-written **SVG** illustrations (a few kB each, `viewBox="0 0 800 600"`, 4:3) in `apps/web/public/images/products/<slug>.svg`; served by CloudFront with long cache.
- `ResponsiveImage` always sets `width`/`height` and wraps the image in an `aspect-ratio: 4 / 3` box with `object-fit: cover` → zero layout shift, nothing out of bounds.
- `loading="lazy"` + `decoding="async"` for below-the-fold; the first two cards load eagerly, the first with `fetchpriority="high"`.
- Skeleton placeholder while loading; fallback placeholder on error.
- Card brand logos are inline SVG components (no network request).

## Accessibility

- Dialog and backdrop trap focus, restore it on close, close on `Esc` (unless paying).
- Errors: `helperText` + `aria-invalid`; summarise submit errors in an `Alert role="alert"`.
- Status changes announced through `aria-live="polite"`.
- Colour contrast ≥ 4.5:1; do not signal state by colour alone (stock chip has text).

## States every data view must handle

loading (skeleton) · empty · error with retry · success.
