import { Value, add, sub, mul, div, pow, exp, relu, sum, dot } from './value';
import { gauss } from './rng';

export interface Config { nEmbd: number; nHead: number; nLayer: number; blockSize: number }
export const DEFAULT_CONFIG: Config = { nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 16 };

export type Params = Map<string, Value[][]>;

// inputs[pos]: normalised embedding; attn[layer][head][s]: weights at the latest position
export interface Recorder { inputs: Value[][]; attn: number[][][] }

// Without an rng all weights are zero, ready to be filled from a snapshot.
export function initParams(cfg: Config, vocabSize: number, rng?: () => number): Params {
  const matrix = (nout: number, nin: number) => Array.from({ length: nout }, () =>
    Array.from({ length: nin }, () => new Value(rng ? gauss(rng, 0.08) : 0)));
  const p: Params = new Map();
  p.set('wte', matrix(vocabSize, cfg.nEmbd));
  p.set('wpe', matrix(cfg.blockSize, cfg.nEmbd));
  p.set('lm_head', matrix(vocabSize, cfg.nEmbd));
  for (let i = 0; i < cfg.nLayer; i++) {
    for (const k of ['attn_wq', 'attn_wk', 'attn_wv', 'attn_wo']) p.set(`layer${i}.${k}`, matrix(cfg.nEmbd, cfg.nEmbd));
    p.set(`layer${i}.mlp_fc1`, matrix(4 * cfg.nEmbd, cfg.nEmbd));
    p.set(`layer${i}.mlp_fc2`, matrix(cfg.nEmbd, 4 * cfg.nEmbd));
  }
  return p;
}

export const flatParams = (p: Params): Value[] => [...p.values()].flat(2);

const linear = (x: Value[], w: Value[][]) => w.map(row => dot(row, x));

export function softmax(logits: Value[]): Value[] {
  const m = Math.max(...logits.map(l => l.data));
  const exps = logits.map(l => exp(sub(l, m)));
  const total = sum(exps);
  return exps.map(e => div(e, total));
}

function rmsnorm(x: Value[]): Value[] {
  const ms = mul(sum(x.map(xi => mul(xi, xi))), 1 / x.length);
  const scale = pow(add(ms, 1e-5), -0.5);
  return x.map(xi => mul(xi, scale));
}

export function gpt(p: Params, cfg: Config, tokenId: number, posId: number,
                    keys: Value[][][], values: Value[][][], rec?: Recorder): Value[] {
  const headDim = cfg.nEmbd / cfg.nHead;
  const tok = p.get('wte')![tokenId], pos = p.get('wpe')![posId];
  let x = rmsnorm(tok.map((t, i) => add(t, pos[i])));
  // Recorded after the norm: rmsnorm is scale-invariant, so grad x input before it is ~0.
  rec?.inputs.push(x);
  for (let li = 0; li < cfg.nLayer; li++) {
    const W = (k: string) => p.get(`layer${li}.${k}`)!;

    let residual = x;
    x = rmsnorm(x);
    const q = linear(x, W('attn_wq')), k = linear(x, W('attn_wk')), v = linear(x, W('attn_wv'));
    keys[li].push(k); values[li].push(v);
    const out: Value[] = [];
    for (let h = 0; h < cfg.nHead; h++) {
      const hs = h * headDim;
      const qh = q.slice(hs, hs + headDim);
      const scores = keys[li].map(kt => div(dot(qh, kt.slice(hs, hs + headDim)), Math.sqrt(headDim)));
      const w = softmax(scores);
      if (rec) (rec.attn[li] ??= [])[h] = w.map(a => a.data);
      for (let j = 0; j < headDim; j++) out.push(dot(w, values[li].map(vt => vt[hs + j])));
    }
    x = linear(out, W('attn_wo')).map((a, i) => add(a, residual[i]));

    residual = x;
    x = linear(rmsnorm(x), W('mlp_fc1')).map(a => relu(a));
    x = linear(x, W('mlp_fc2')).map((a, i) => add(a, residual[i]));
  }
  return linear(x, p.get('lm_head')!);
}
