export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 500) return '<1 s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const formatMs = (ms: number) => (ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);

const NAMED: Record<string, string> = { '\u200d': 'ZWJ', '\u200c': 'ZWNJ' };

// Tokens are code points, so a button can hold whitespace, a lone vowel sign or an invisible joiner.
export function charLabel(ch: string): string {
  if (ch === ' ') return '␣';
  if (ch === '\t') return '⇥';
  if (NAMED[ch]) return NAMED[ch];
  if (/^\p{M}$/u.test(ch)) return `◌${ch}`;
  if (/^[\p{Cf}\p{Cc}]$/u.test(ch)) return `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
  return ch;
}

// True when a string only reads correctly with its characters joined up.
export const needsShaping = (text: string) => /[\p{M}\p{Cf}]/u.test(text);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
