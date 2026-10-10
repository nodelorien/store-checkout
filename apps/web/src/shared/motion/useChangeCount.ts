import { useState } from 'react';

/** How many times `value` changed since the component mounted (0 until the first change). */
export function useChangeCount<T>(value: T): number {
  const [previous, setPrevious] = useState(value);
  const [changes, setChanges] = useState(0);

  // Derived during render (React's "adjust state when a prop changes" pattern), not in an effect.
  if (!Object.is(previous, value)) {
    setPrevious(value);
    setChanges(changes + 1);
  }
  return changes;
}
