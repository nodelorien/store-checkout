/** Styles for text that only assistive technology should perceive. */
export const visuallyHidden = {
  position: 'absolute',
  // Anchored, so its static position can never widen the page.
  left: 0,
  margin: -1,
  padding: 0,
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
