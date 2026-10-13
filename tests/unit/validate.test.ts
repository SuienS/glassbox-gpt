import { expect, test } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/engine/model';
import { DESKTOP, MOBILE, validateConfig, validateText } from '../../src/engine/validate';

test('counts lines, characters and truncated documents', () => {
  // blockSize 4: "abc" gives 4 predictions and fits; "abcd" gives 5 and is cut; the emoji is one character
  const r = validateText('abc\r\n\n  abcd \n🙂🙂🙂\n', 4);
  expect(r).toMatchObject({ lines: 3, vocab: 5, truncated: 1, errors: [] });
  expect(r.docs).toEqual(['abc', 'abcd', '🙂🙂🙂']);
  expect(r.warnings).toEqual(['1 line exceeds the block size and will be cut.']);
});

test('empty input is an error', () => {
  expect(validateText(' \n\n', 16).errors).toEqual(['No non-empty lines found.']);
});

test('line and byte caps depend on the limits', () => {
  const lines = Array.from({ length: 25_000 }, (_, i) => `n${i % 10}`).join('\n');
  expect(validateText(lines, 16, DESKTOP).errors).toEqual([]);
  expect(validateText(lines, 16, MOBILE).errors).toEqual(['Too many lines (25,000; maximum 20,000).']);
  const big = 'ශ්‍රී\n'.repeat(80_000); // multi-byte characters count by bytes, not length
  expect(validateText(big, 16, MOBILE).errors[0]).toMatch(/limit is 1\.0 MB/);
});

test('large vocabularies get a warning', () => {
  const text = Array.from({ length: 120 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join('\n');
  expect(validateText(text, 16).warnings).toEqual(['120 distinct characters will slow training.']);
});

test('the default config is valid on both desktop and mobile', () => {
  expect(validateConfig(DEFAULT_CONFIG, 1000)).toEqual([]);
  expect(validateConfig(DEFAULT_CONFIG, 1000, DESKTOP)).toEqual([]);
  expect(validateConfig(DEFAULT_CONFIG, 1000, MOBILE)).toEqual([]);
});

test('config errors', () => {
  expect(validateConfig({ ...DEFAULT_CONFIG, nHead: 3 }, 1000)).toEqual(['nHead (3) must divide nEmbd (16).']);
  expect(validateConfig({ ...DEFAULT_CONFIG, nLayer: 0 }, 1.5)).toEqual([
    'nLayer must be a positive whole number.', 'numSteps must be a positive whole number.',
  ]);
  const big = { nEmbd: 48, nHead: 8, nLayer: 3, blockSize: 32 };
  expect(validateConfig(big, 5000, DESKTOP)).toEqual([]);
  expect(validateConfig(big, 5000, MOBILE)).toHaveLength(5);
  expect(validateConfig(big, 5000)).toEqual([]);
});
