import { type Config, type Params, paramShapes } from './model';

// The same forward pass as gpt(), on plain numbers: no graph and no gradients, for when only
// probabilities are needed. Every operation is in the same order as gpt(), so results match exactly.

export type NumParams = Map<string, ArrayLike<number>[]>;

// Rows are views into the snapshot, not copies.
export function numParams(w: Float64Array, cfg: Config, vocabSize: number): NumParams {
  const p: NumParams = new Map();
  let off = 0;
  for (const [name, nout, nin] of paramShapes(cfg, vocabSize)) {
    p.set(name, Array.from({ length: nout }, () => w.subarray(off, (off += nin))));
  }
  if (off !== w.length) throw new Error(`Snapshot has ${w.length} weights, config needs ${off}`);
  return p;
}

export const numParamsOf = (p: Params): NumParams =>
  new Map([...p].map(([name, m]) => [name, m.map(row => row.map(v => v.data))]));

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const linear = (x: number[], w: ArrayLike<number>[]) => w.map(row => dot(row, x));

// Matches model.softmax: e * total^-1 rather than e / total.
export function softmaxNums(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - m));
  const inv = exps.reduce((s, e) => s + e, 0) ** -1;
  return exps.map(e => e * inv);
}

function rmsnorm(x: number[]): number[] {
  const ms = x.reduce((s, xi) => s + xi * xi, 0) * (1 / x.length);
  const scale = (ms + 1e-5) ** -0.5;
  return x.map(xi => xi * scale);
}

export function gptNumbers(p: NumParams, cfg: Config, tokenId: number, posId: number,
                           keys: number[][][], values: number[][][]): number[] {
  const headDim = cfg.nEmbd / cfg.nHead;
  const tok = p.get('wte')![tokenId], pos = p.get('wpe')![posId];
  let x = rmsnorm(Array.from(tok, (t, i) => t + pos[i]));
  for (let li = 0; li < cfg.nLayer; li++) {
    const W = (k: string) => p.get(`layer${li}.${k}`)!;

    let residual = x;
    x = rmsnorm(x);
    const q = linear(x, W('attn_wq')), k = linear(x, W('attn_wk')), v = linear(x, W('attn_wv'));
    keys[li].push(k); values[li].push(v);
    const out: number[] = [];
    for (let h = 0; h < cfg.nHead; h++) {
      const hs = h * headDim;
      const qh = q.slice(hs, hs + headDim);
      const w = softmaxNums(keys[li].map(kt => dot(qh, kt.slice(hs, hs + headDim)) * (1 / Math.sqrt(headDim))));
      for (let j = 0; j < headDim; j++) out.push(dot(w, values[li].map(vt => vt[hs + j])));
    }
    x = linear(out, W('attn_wo')).map((a, i) => a + residual[i]);

    residual = x;
    x = linear(rmsnorm(x), W('mlp_fc1')).map(a => Math.max(0, a));
    x = linear(x, W('mlp_fc2')).map((a, i) => a + residual[i]);
  }
  return linear(x, p.get('lm_head')!);
}
