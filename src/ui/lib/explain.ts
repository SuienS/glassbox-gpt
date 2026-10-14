import { softmaxNums } from '../../engine/infer';

export interface Candidate { token: number; p: number; pT: number | null }

// The k most likely next tokens at T = 1, with their probability at the sampling temperature
// when that differs. The chosen token is always included, even when it was a long shot.
export function candidates(logits: number[], c: number, temperature: number, k = 5): Candidate[] {
  const p = softmaxNums(logits);
  const pT = temperature === 1 ? null : softmaxNums(logits.map(z => z / temperature));
  const top = p.map((_, i) => i).sort((a, b) => p[b] - p[a]).slice(0, k);
  if (!top.includes(c)) top.push(c);
  return top.map(token => ({ token, p: p[token], pT: pT && pT[token] }));
}

export type Verdict = 'none' | 'inconclusive' | 'weak' | 'supported';

// k characters are deleted from positions 1..t. With t <= k, salient and random pick the same set.
export function deletionVerdict(t: number, k: number, d: { salientDrop: number; randomDrop: number; randomStd: number } | null): Verdict {
  if (t === 0) return 'none';
  if (t <= k) return 'inconclusive';
  if (!d) return 'none';
  return d.salientDrop < d.randomDrop + d.randomStd ? 'weak' : 'supported';
}

export const peak = (row: number[]) => row.reduce((best, v, i) => (v > row[best] ? i : best), 0);

export function pct(x: number): string {
  const v = x * 100;
  if (v > 0 && v < 1) return '<1%';
  return `${Math.round(v)}%`;
}
