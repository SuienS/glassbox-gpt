import { expect, test } from 'vitest';
import { softmaxNums } from '../../src/engine/infer';
import { candidates, deletionVerdict, peak, pct } from '../../src/ui/lib/explain';

const logits = [2, 0.5, 1, -1, 0, 3, -2];

test('candidates are ordered by probability and always include the chosen token', () => {
  const top = candidates(logits, 6, 1, 3);
  expect(top.map(x => x.token)).toEqual([5, 0, 2, 6]);
  expect(top[0].p).toBe(softmaxNums(logits)[5]);
  expect(top.every(x => x.pT === null)).toBe(true);
});

test('candidates carry the sampling-temperature probability', () => {
  const top = candidates(logits, 5, 0.5);
  expect(top).toHaveLength(5);
  expect(top[0].pT).toBe(softmaxNums(logits.map(z => z / 0.5))[5]);
  expect(top[0].pT!).toBeGreaterThan(top[0].p); // a lower temperature sharpens the favourite
});

test('deletion verdicts', () => {
  const d = (salientDrop: number) => ({ salientDrop, randomDrop: 0.2, randomStd: 0.1 });
  expect(deletionVerdict(0, 2, null)).toBe('none');
  expect(deletionVerdict(2, 2, d(0.9))).toBe('inconclusive');
  expect(deletionVerdict(5, 2, d(0.29))).toBe('weak');
  expect(deletionVerdict(5, 2, d(0.31))).toBe('supported');
});

test('peak and pct', () => {
  expect(peak([0.1, 0.5, 0.5, 0.2])).toBe(1);
  expect(pct(0.4149)).toBe('41%');
  expect(pct(0.004)).toBe('<1%');
  expect(pct(0)).toBe('0%');
  expect(pct(-0.25)).toBe('-25%');
});
