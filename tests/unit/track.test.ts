import { afterEach, expect, test, vi } from 'vitest';
import { track } from '../../src/ui/track';

afterEach(() => { delete (globalThis as { goatcounter?: unknown }).goatcounter; });

test('does nothing without the GoatCounter script', () => {
  expect(() => track('compare')).not.toThrow();
});

test('sends each event once per visit, under the app prefix', () => {
  const count = vi.fn();
  (globalThis as { goatcounter?: unknown }).goatcounter = { count };
  track('train-start');
  track('train-start');
  track('explain-open');
  expect(count.mock.calls.map(c => c[0])).toEqual([
    { path: 'glassbox-gpt/train-start', title: 'train-start', event: true },
    { path: 'glassbox-gpt/explain-open', title: 'explain-open', event: true },
  ]);
});
