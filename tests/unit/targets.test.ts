import { expect, test } from 'vitest';
import { targetFor } from '../../src/explain/targets';

// BOS = 26; "ab" then the end token
const tokens = [26, 0, 1, 26];

test('character k is predicted at position k - 1', () => {
  expect(targetFor(tokens, 1)).toEqual({ t: 0, c: 0 });
  expect(targetFor(tokens, 2)).toEqual({ t: 1, c: 1 });
});

test('the end token can be explained too', () => {
  expect(targetFor(tokens, 3)).toEqual({ t: 2, c: 26 });
});

test('the leading BOS and out-of-range indices are rejected', () => {
  for (const k of [0, 4, -1, 1.5]) expect(() => targetFor(tokens, k)).toThrow(RangeError);
});
