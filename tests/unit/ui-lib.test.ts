import { expect, test } from 'vitest';
import { charLabel, formatDuration, formatMs } from '../../src/ui/lib/format';
import { extendEma } from '../../src/ui/lib/loss';

test('extendEma continues the average across calls', () => {
  const once = extendEma([], [4, 2, 3, 1]);
  expect(once[0]).toBe(4);
  expect(once[1]).toBeCloseTo(0.95 * 4 + 0.05 * 2, 15);
  expect(extendEma(extendEma([], [4, 2]), [3, 1])).toEqual(once);
});

test('durations and timings read naturally', () => {
  expect(formatDuration(400)).toBe('0 s');
  expect(formatDuration(42_400)).toBe('42 s');
  expect(formatDuration(125_000)).toBe('2 min 5 s');
  expect(formatDuration(3_725_000)).toBe('1 h 2 min');
  expect(formatDuration(NaN)).toBe('–');
  expect(formatMs(2.71)).toBe('2.7 ms');
  expect(formatMs(37.4)).toBe('37 ms');
});

test('whitespace gets a visible label', () => {
  expect(charLabel(' ')).toBe('␣');
  expect(charLabel('\t')).toBe('⇥');
  expect(charLabel('ශ')).toBe('ශ');
});
