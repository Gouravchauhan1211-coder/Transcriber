// Allowed characters: letters, numbers, spaces, basic punctuation
const ALLOWED_TEXT_RE = /^[\w\s.,!?'"()\-:;@#&*+=%/\u0900-\u097F\u0980-\u09FF]*$/;
const MAX_TEXT_LENGTH = 5000;

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.slice(0, MAX_TEXT_LENGTH).trim();
  // Replace anything that's not in our allowed set with empty string
  return trimmed.replace(/[^\w\s.,!?'"()\-:;@#&*+=%/\u0900-\u097F\u0980-\u09FF]/g, '');
}

export function sanitizeSessionId(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

export function sanitizeLanguage(input: unknown): 'en-US' | 'hi-IN' | 'hi' {
  const allowed = ['en-US', 'hi-IN', 'hi'];
  if (typeof input === 'string' && allowed.includes(input)) {
    return input as 'en-US' | 'hi-IN' | 'hi';
  }
  return 'en-US';
}
