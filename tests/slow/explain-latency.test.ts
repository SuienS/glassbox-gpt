import { expect, test } from 'vitest';
import { explain } from '../../src/explain';
import { deletionTest } from '../../src/explain/deletion';
import { trained } from '../unit/fixtures';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = (f: () => unknown, runs = 9) => median(Array.from({ length: runs }, () => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
}));

test('explanations are fast enough for click-to-explain', () => {
  const { cfg, w, vocabSize, tok } = trained();
  const tokens = [tok.bos, ...tok.encode('jacquelinemarie')];
  const t = tokens.length - 1;
  const c = tokens[1], other = tokens[2];

  const explainMs = time(() => explain(w, cfg, vocabSize, tokens, t, c));
  const contrastMs = time(() => explain(w, cfg, vocabSize, tokens, t, c, other));
  const deletion20 = time(() => deletionTest(w, cfg, vocabSize, { tokens, t, c, k: 2, trials: 20, seed: 1 }), 5);
  const deletion50 = time(() => deletionTest(w, cfg, vocabSize, { tokens, t, c, k: 2, trials: 50, seed: 1 }), 5);
  console.log(`t=${t}: explain ${explainMs.toFixed(1)} ms, with contrast ${contrastMs.toFixed(1)} ms, ` +
    `deletion x20 ${deletion20.toFixed(1)} ms, x50 ${deletion50.toFixed(1)} ms`);
  expect(contrastMs).toBeLessThan(200);
}, 60_000);
