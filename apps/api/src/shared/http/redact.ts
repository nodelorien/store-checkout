/**
 * Redaction for anything that may end up in a log line. Keys that can hold card tokens, keys,
 * secrets or personal data are masked whatever their value; free text has emails and long digit
 * runs (phones, card numbers) masked.
 */

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /(token|secret|password|authorization|signature|checksum|private|key|email|phone|name|address|city|region|postal|card|number|cvc|cvv|exp|last_?four|legal_?id)/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS = /\+?\d[\d\s-]{6,}\d/g;
const MAX_DEPTH = 6;

export function redactText(text: string): string {
  return text.replace(EMAIL, REDACTED).replace(LONG_DIGITS, REDACTED);
}

export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(inner, depth + 1);
  }
  return output;
}
