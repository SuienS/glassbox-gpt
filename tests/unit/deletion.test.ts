import { expect, test } from 'vitest';
import { deletionSets, deletionTest } from '../../src/explain/deletion';
import { probsAtLast } from '../../src/explain/forward';
import { trained } from './fixtures';

const { cfg, w, vocabSize, tok } = trained();
const tokens = [tok.bos, ...tok.encode('jasmine'), tok.bos];

test('k is capped at t and BOS is never deleted', () => {
  const sal = [0.9, 0.05, 0.02, 0.03];
  for (const k of [0, 1, 2, 3, 10]) {
    const { top, random } = deletionSets(sal, 3, k, 20, 1);
    for (const set of [top, ...random]) {
      expect(set).toHaveLength(Math.min(k, 3));
      expect(new Set(set).size).toBe(set.length);
      expect(set.every(i => i >= 1 && i <= 3)).toBe(true);
    }
  }
  expect(deletionSets(sal, 3, 2, 1, 1).top).toEqual([1, 3]);
});

test('same seed, same result', () => {
  const req = { tokens, t: 5, c: tokens[6], k: 2, trials: 20, seed: 7 };
  expect(deletionTest(w, cfg, vocabSize, req)).toEqual(deletionTest(w, cfg, vocabSize, req));
  expect(deletionSets([0, 1, 2, 3], 3, 1, 5, 7)).toEqual(deletionSets([0, 1, 2, 3], 3, 1, 5, 7));
});

test('baseline is p(c) on the full context and drops are finite', () => {
  const r = deletionTest(w, cfg, vocabSize, { tokens, t: 5, c: tokens[6], k: 2, trials: 20, seed: 1 });
  expect(r.p).toBe(probsAtLast(w, cfg, vocabSize, tokens.slice(0, 6))[tokens[6]]);
  for (const x of [r.salientDrop, r.randomDrop, r.randomStd]) expect(Number.isFinite(x)).toBe(true);
  expect(r.randomStd).toBeGreaterThanOrEqual(0);
});

test('t = 0 has nothing to delete', () => {
  const r = deletionTest(w, cfg, vocabSize, { tokens, t: 0, c: tokens[1], k: 2, trials: 20, seed: 1 });
  expect(r).toMatchObject({ salientDrop: 0, randomDrop: 0, randomStd: 0 });
  expect(r.p).toBeGreaterThan(0);
});
