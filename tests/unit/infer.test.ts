import { expect, test } from 'vitest';
import { mul, type Value } from '../../src/engine/value';
import { choice, mulberry32 } from '../../src/engine/rng';
import { type Config, gpt, softmax } from '../../src/engine/model';
import { gptNumbers, numParams, numParamsOf, softmaxNums } from '../../src/engine/infer';
import { loadParams } from '../../src/engine/serialize';
import { sample } from '../../src/engine/sample';
import type { TrainState } from '../../src/engine/train';
import { probsAtLast, recordForward } from '../../src/explain/forward';
import { trained } from './fixtures';

const configs: Config[] = [
  { nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 16 },
  { nEmbd: 48, nHead: 8, nLayer: 3, blockSize: 32 },
  { nEmbd: 12, nHead: 3, nLayer: 2, blockSize: 8 },
];

test.each(configs)('plain-number logits equal the Value logits exactly (%o)', cfg => {
  const { w, vocabSize, tok } = trained(cfg, 3);
  const p = loadParams(w, cfg, vocabSize), np = numParams(w, cfg, vocabSize);
  const kv = <T>() => Array.from({ length: cfg.nLayer }, () => [] as T[][]);
  const [k1, v1, k2, v2] = [kv<Value>(), kv<Value>(), kv<number>(), kv<number>()];
  const rng = mulberry32(1);
  let token = tok.bos;
  for (let pos = 0; pos < cfg.blockSize; pos++) {
    const a = gpt(p, cfg, token, pos, k1, v1).map(l => l.data);
    const b = gptNumbers(np, cfg, token, pos, k2, v2);
    expect(b).toEqual(a);
    token = Math.floor(rng() * vocabSize);
  }
});

test('numParams reads rows straight from the snapshot', () => {
  const { cfg, w, vocabSize } = trained(undefined, 1);
  const np = numParams(w, cfg, vocabSize);
  expect([...np.values()].flat().reduce((n, row) => n + row.length, 0)).toBe(w.length);
  expect((np.get('wte')![0] as Float64Array).buffer).toBe(w.buffer);
  expect(() => numParams(w.subarray(1), cfg, vocabSize)).toThrow(/Snapshot has/);
});

test('numParamsOf matches numParams on the same weights', () => {
  const { cfg, w, vocabSize } = trained(undefined, 1);
  const a = numParamsOf(loadParams(w, cfg, vocabSize)), b = numParams(w, cfg, vocabSize);
  for (const [name, rows] of a) rows.forEach((row, i) => expect(row).toEqual(Array.from(b.get(name)![i])));
});

test('probsAtLast matches the Value forward pass and model.softmax', () => {
  const { cfg, w, vocabSize, tok } = trained();
  const seq = [tok.bos, ...tok.encode('jasmine')];
  const logits = recordForward(loadParams(w, cfg, vocabSize), cfg, seq, seq.length - 1).logits;
  const viaValues = softmax(logits).map(p => p.data);
  expect(softmaxNums(logits.map(l => l.data))).toEqual(viaValues);
  expect(probsAtLast(w, cfg, vocabSize, seq)).toEqual(viaValues);
});

// The previous Value-based sampler, kept here as the reference.
function sampleWithValues(st: TrainState, count: number, temperature: number) {
  const { cfg, tok, p } = st;
  return Array.from({ length: count }, () => {
    const keys = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
    const values = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
    const seq = [tok.bos];
    for (let pos = 0; pos < cfg.blockSize; pos++) {
      const probs = softmax(gpt(p, cfg, seq[pos], pos, keys, values).map(l => mul(l, 1 / temperature)));
      seq.push(choice(probs.map(q => q.data), st.sampleRng));
      if (seq.at(-1) === tok.bos) break;
    }
    return seq;
  });
}

test('sampling gives exactly the same tokens as the Value path', () => {
  const { cfg, w, vocabSize, tok } = trained();
  const state = (): TrainState => ({
    cfg, tok, p: loadParams(w, cfg, vocabSize), params: [], m: new Float64Array(), v: new Float64Array(),
    docs: [], step: 0, numSteps: 1, sampleRng: mulberry32(5),
  });
  for (const temperature of [0.5, 1, 1.3]) {
    expect(sample(state(), 30, temperature).tokens).toEqual(sampleWithValues(state(), 30, temperature));
  }
});
