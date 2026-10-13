import { mul, type Value } from './value';
import { choice } from './rng';
import { gpt, softmax } from './model';
import type { TrainState } from './train';

// Each sample starts at BOS and stops at BOS or blockSize; tokens include the leading BOS.
export function sample(st: TrainState, count: number, temperature: number) {
  const { cfg, tok, p } = st;
  const tokens: number[][] = [];
  for (let s = 0; s < count; s++) {
    const keys = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
    const values = Array.from({ length: cfg.nLayer }, () => [] as Value[][]);
    const seq = [tok.bos];
    for (let pos = 0; pos < cfg.blockSize; pos++) {
      const logits = gpt(p, cfg, seq[pos], pos, keys, values);
      const probs = softmax(logits.map(l => mul(l, 1 / temperature)));
      const next = choice(probs.map(q => q.data), st.sampleRng);
      seq.push(next);
      if (next === tok.bos) break;
    }
    tokens.push(seq);
  }
  return { tokens, text: tokens.map(t => tok.decode(t)) };
}
