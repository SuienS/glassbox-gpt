import type { Value } from '../engine/value';
import { type Config, type Params, type Recorder, gpt } from '../engine/model';
import { gptNumbers, numParams, softmaxNums } from '../engine/infer';

export function checkQuery(cfg: Config, vocabSize: number, tokens: number[], t: number, ...ids: Array<number | undefined>) {
  if (!Number.isInteger(t) || t < 0 || t >= tokens.length || t >= cfg.blockSize) {
    throw new RangeError(`Position ${t} is outside the context`);
  }
  for (const id of [...tokens.slice(0, t + 1), ...ids]) {
    if (id !== undefined && !(Number.isInteger(id) && id >= 0 && id < vocabSize)) {
      throw new RangeError(`Token ${id} is outside the vocabulary`);
    }
  }
}

// Runs positions 0..t with a shared KV cache. Returns position t's logits and attention,
// the recorded inputs for every position, and every position's attention rows (for rollout).
export function recordForward(p: Params, cfg: Config, tokens: number[], t: number) {
  const keys = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
  const values = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
  const rec: Recorder = { inputs: [], attn: [], detachNorms: true };
  const rows: number[][][][] = []; // [pos][layer][head][s]
  let logits: Value[] = [];
  for (let pos = 0; pos <= t; pos++) {
    logits = gpt(p, cfg, tokens[pos], pos, keys, values, rec);
    rows.push(rec.attn.map(layer => [...layer]));
  }
  return { logits, inputs: rec.inputs, attn: rec.attn, rows };
}

// Forward only, so it runs on plain numbers.
export function probsAtLast(w: Float64Array, cfg: Config, vocabSize: number, seq: number[]): number[] {
  const p = numParams(w, cfg, vocabSize);
  const keys = Array.from({ length: cfg.nLayer }, () => [] as number[][]);
  const values = Array.from({ length: cfg.nLayer }, () => [] as number[][]);
  let logits: number[] = [];
  seq.forEach((tok, pos) => { logits = gptNumbers(p, cfg, tok, pos, keys, values); });
  return softmaxNums(logits);
}
