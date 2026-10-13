import { Value, neg, log, mul, sum, backward } from './value';
import { mulberry32, shuffle } from './rng';
import { buildTokenizer, type Tokenizer } from './tokenizer';
import { type Config, type Params, initParams, flatParams, gpt, softmax } from './model';
import { loadParams } from './serialize';

export interface TrainState {
  cfg: Config; tok: Tokenizer; p: Params; params: Value[];
  m: Float64Array; v: Float64Array;
  docs: string[]; step: number; numSteps: number;
  sampleRng: () => number;
}

function makeState(cfg: Config, tok: Tokenizer, p: Params, docs: string[], numSteps: number, seed: number): TrainState {
  const params = flatParams(p);
  return {
    cfg, tok, p, params,
    m: new Float64Array(params.length), v: new Float64Array(params.length),
    docs, step: 0, numSteps, sampleRng: mulberry32(seed + 1),
  };
}

export function createState(cfg: Config, docs: string[], seed: number, numSteps: number): TrainState {
  const rng = mulberry32(seed);
  const shuffled = shuffle([...docs], rng);
  const tok = buildTokenizer(shuffled);
  return makeState(cfg, tok, initParams(cfg, tok.vocabSize, rng), shuffled, numSteps, seed);
}

export function createStateFromWeights(cfg: Config, tok: Tokenizer, weights: ArrayLike<number>,
                                       numSteps: number, docs: string[] = []): TrainState {
  return makeState(cfg, tok, loadParams(weights, cfg, tok.vocabSize), docs, numSteps, 0);
}

// Mean cross-entropy over one document; leaves gradients on the params.
export function forwardBackward(st: TrainState, doc: string): number {
  const { cfg, tok, p } = st;
  const tokens = [tok.bos, ...tok.encode(doc), tok.bos];
  const n = Math.min(cfg.blockSize, tokens.length - 1);
  const keys = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
  const values = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
  const losses: Value[] = [];
  for (let pos = 0; pos < n; pos++) {
    const probs = softmax(gpt(p, cfg, tokens[pos], pos, keys, values));
    losses.push(neg(log(probs[tokens[pos + 1]])));
  }
  const loss = mul(sum(losses), 1 / n);
  backward(loss);
  return loss.data;
}

export function adamUpdate(st: TrainState): void {
  const lr = 0.01, b1 = 0.85, b2 = 0.99, eps = 1e-8;
  const lrT = lr * (1 - st.step / st.numSteps);
  for (let i = 0; i < st.params.length; i++) {
    const p = st.params[i], g = p.grad;
    st.m[i] = b1 * st.m[i] + (1 - b1) * g;
    st.v[i] = b2 * st.v[i] + (1 - b2) * g ** 2;
    const mHat = st.m[i] / (1 - b1 ** (st.step + 1));
    const vHat = st.v[i] / (1 - b2 ** (st.step + 1));
    p.data -= lrT * mHat / (vHat ** 0.5 + eps);
    p.grad = 0;
  }
  st.step++;
}

export function trainStep(st: TrainState): number {
  const loss = forwardBackward(st, st.docs[st.step % st.docs.length]);
  adamUpdate(st);
  return loss;
}
