import { expect, test } from 'vitest';
import ref from '../../reference/reference.json';
import names from '../../public/presets/names.txt?raw';
import { buildTokenizer, parseDocs, tokenizerFromChars } from '../../src/engine/tokenizer';
import { createStateFromWeights, forwardBackward, adamUpdate } from '../../src/engine/train';

const maxDiff = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

test('tokenizer matches Python on names.txt', () => {
  expect(buildTokenizer(parseDocs(names)).chars).toEqual(ref.uchars);
});

test('one training step matches Python', () => {
  const c = ref.config;
  const cfg = { nEmbd: c.n_embd, nHead: c.n_head, nLayer: c.n_layer, blockSize: c.block_size };
  const st = createStateFromWeights(cfg, tokenizerFromChars(ref.uchars), ref.init, 1);
  expect(st.params.length).toBe(ref.init.length);

  const loss = forwardBackward(st, ref.doc);
  expect(Math.abs(loss - ref.loss)).toBeLessThan(1e-9);
  expect(maxDiff(st.params.map(p => p.grad), ref.grads)).toBeLessThan(1e-9);

  adamUpdate(st);
  expect(maxDiff(st.params.map(p => p.data), ref.after)).toBeLessThan(1e-9);
});
