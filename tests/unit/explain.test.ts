import { expect, test } from 'vitest';
import { explain, rollout } from '../../src/explain';
import { attribute } from '../../src/explain/attribute';
import { probsAtLast } from '../../src/explain/forward';
import { softmaxNums } from '../../src/engine/infer';
import { trained } from './fixtures';

const { cfg, w, vocabSize, tok } = trained();
const tokens = [tok.bos, ...tok.encode('jasmine'), tok.bos];
const t = 4, c = tokens[t + 1];
const other = tok.encode('o')[0];
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('saliency covers positions 0..t and sums to 1', () => {
  const { saliency } = explain(w, cfg, vocabSize, tokens, t, c);
  expect(saliency).toHaveLength(t + 1);
  expect(saliency.every(s => s >= 0)).toBe(true);
  expect(Math.abs(total(saliency) - 1)).toBeLessThan(1e-12);
});

test('raw attribution is not degenerate', () => {
  const raw = attribute(w, cfg, vocabSize, tokens, t, c).map(Math.abs);
  expect(total(raw)).toBeGreaterThan(0.01);
  expect(raw.filter(s => s > 1e-3 * total(raw)).length).toBeGreaterThan(1);
});

test('contrast of c against itself is all zeros', () => {
  const e = explain(w, cfg, vocabSize, tokens, t, c, c);
  expect(e.contrast!.every(x => x === 0)).toBe(true);
  expect(e.logitGap).toBe(0);
});

test('contrast is the difference of the two attributions and flips sign when swapped', () => {
  const ab = attribute(w, cfg, vocabSize, tokens, t, c, other);
  const ba = attribute(w, cfg, vocabSize, tokens, t, other, c);
  const a = attribute(w, cfg, vocabSize, tokens, t, c), b = attribute(w, cfg, vocabSize, tokens, t, other);
  ab.forEach((x, i) => {
    expect(Math.abs(x + ba[i])).toBeLessThan(1e-12);
    expect(Math.abs(x - (a[i] - b[i]))).toBeLessThan(1e-12);
  });
  const { logitGap } = explain(w, cfg, vocabSize, tokens, t, c, other);
  const p = probsAtLast(w, cfg, vocabSize, tokens.slice(0, t + 1));
  expect(Math.abs(logitGap! - Math.log(p[c] / p[other]))).toBeLessThan(1e-9);
});

test('leaves the snapshot untouched and repeats exactly', () => {
  const copy = w.slice();
  const a = explain(w, cfg, vocabSize, tokens, t, c, other);
  const b = explain(w, cfg, vocabSize, tokens, t, c, other);
  expect(w).toEqual(copy);
  expect(a).toEqual(b);
});

test('ignores tokens after position t', () => {
  expect(explain(w, cfg, vocabSize, tokens, t, c)).toEqual(explain(w, cfg, vocabSize, tokens.slice(0, t + 1), t, c));
});

test('attention rows are distributions over 0..t', () => {
  const e = explain(w, cfg, vocabSize, tokens, t, c);
  expect(e.attention).toHaveLength(cfg.nHead);
  for (const row of [...e.attention, e.meanAttention]) {
    expect(row).toHaveLength(t + 1);
    expect(Math.abs(total(row) - 1)).toBeLessThan(1e-12);
  }
  expect(e.rollout).toBeUndefined();
});

test('top-5 is the model distribution at position t', () => {
  const { topK, logits } = explain(w, cfg, vocabSize, tokens, t, c);
  const p = probsAtLast(w, cfg, vocabSize, tokens.slice(0, t + 1));
  expect(softmaxNums(logits)).toEqual(p);
  expect(topK).toHaveLength(5);
  expect(topK.map(x => x.p)).toEqual([...p].sort((a, b) => b - a).slice(0, 5));
  topK.forEach(({ token, p: q }) => expect(p[token]).toBe(q));
});

test('works at t = 0', () => {
  const e = explain(w, cfg, vocabSize, tokens, 0, tokens[1]);
  expect(e.saliency).toEqual([1]);
  expect(e.meanAttention).toEqual([1]);
});

test('rejects positions and tokens outside the model', () => {
  expect(() => explain(w, cfg, vocabSize, tokens, tokens.length, c)).toThrow(/outside the context/);
  expect(() => explain(w, cfg, vocabSize, tokens, -1, c)).toThrow(/outside the context/);
  expect(() => explain(w, cfg, vocabSize, tokens, t, vocabSize)).toThrow(/outside the vocabulary/);
  expect(() => explain(w, cfg, vocabSize, tokens, t, c, -1)).toThrow(/outside the vocabulary/);
});

test('rollout matches the explicit matrix product', () => {
  // rows[pos][layer][head][s]: 3 positions, 2 layers, 2 heads
  const rows = [
    [[[1], [1]], [[1], [1]]],
    [[[0.2, 0.8], [0.6, 0.4]], [[0.9, 0.1], [0.5, 0.5]]],
    [[[0.1, 0.3, 0.6], [0.3, 0.3, 0.4]], [[0.7, 0.2, 0.1], [0.2, 0.2, 0.6]]],
  ];
  const A = (li: number) => rows.map((r, i) => {
    const row = [0, 1, 2].map(s => 0.5 * ((r[li][0][s] ?? 0) + (r[li][1][s] ?? 0)) / 2 + (s === i ? 0.5 : 0));
    return row.map(x => x / total(row));
  });
  const [A0, A1] = [A(0), A(1)];
  const expected = [0, 1, 2].map(s => total([0, 1, 2].map(i => A1[2][i] * A0[i][s])));
  rollout(rows, 2).forEach((x, s) => expect(Math.abs(x - expected[s])).toBeLessThan(1e-15));
});

test('two-layer models get a rollout row', () => {
  const two = trained({ nEmbd: 8, nHead: 2, nLayer: 2, blockSize: 16 }, 20);
  const toks = [two.tok.bos, ...two.tok.encode('anna')];
  const e = explain(two.w, two.cfg, two.vocabSize, toks, 3, toks[4]);
  expect(e.rollout).toHaveLength(4);
  expect(e.rollout!.every(x => x >= 0)).toBe(true);
  expect(Math.abs(total(e.rollout!) - 1)).toBeLessThan(1e-12);
});
