import { expect, test } from 'vitest';
import { charLabel, formatBytes, formatDuration, formatMs, needsShaping } from '../../src/ui/lib/format';
import { guessDevice } from '../../src/ui/lib/limits';
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
  expect(formatDuration(NaN)).toBe('-');
  expect(formatMs(2.71)).toBe('2.7 ms');
  expect(formatMs(37.4)).toBe('37 ms');
});

test('whitespace gets a visible label', () => {
  expect(charLabel(' ')).toBe('␣');
  expect(charLabel('\t')).toBe('⇥');
  expect(charLabel('ශ')).toBe('ශ');
});

test('formatBytes', () => {
  expect(formatBytes(900)).toBe('900 B');
  expect(formatBytes(228_145)).toBe('223 KB');
  expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
});

test('narrow screens and few cores get the phone limits', () => {
  expect(guessDevice(1280, 8)).toBe('desktop');
  expect(guessDevice(1280, undefined)).toBe('desktop');
  expect(guessDevice(640, 8)).toBe('mobile');
  expect(guessDevice(1280, 4)).toBe('mobile');
});

test('marks and invisible characters get a visible label', () => {
  expect(charLabel('\u0dca')).toBe('◌\u0dca'); // Sinhala al-lakuna
  expect(charLabel('\u200d')).toBe('ZWJ');
  expect(charLabel('\u00ad')).toBe('U+00AD');
  expect(charLabel('🙂')).toBe('🙂');
  expect(needsShaping('අම්මා')).toBe(true);
  expect(needsShaping('emma 🙂')).toBe(false);
});
