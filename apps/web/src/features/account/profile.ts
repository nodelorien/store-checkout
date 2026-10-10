/**
 * The signed-in customer. This store has no accounts: the session is a fixed demo profile, shown
 * the way a signed-in shop would show it. Nothing here is sent to the API.
 */
export const DEMO_PROFILE = { name: 'Alex Rivera', email: 'alex.rivera@example.com' } as const;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word[0].toUpperCase()).join('');
}
