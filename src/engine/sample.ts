import { choice } from './rng';
import { gptNumbers, numParamsOf, softmaxNums } from './infer';
import type { TrainState } from './train';

// Each sample starts at BOS and stops at BOS or blockSize; tokens include the leading BOS.
export function sample(st: TrainState, count: number, temperature: number) {
  const { cfg, tok } = st;
  const p = numParamsOf(st.p);
  const tokens: number[][] = [];
  for (let s = 0; s < count; s++) {
    const keys = Array.from({ length: cfg.nLayer }, () => [] as number[][]);
    const values = Array.from({ length: cfg.nLayer }, () => [] as number[][]);
    const seq = [tok.bos];
    for (let pos = 0; pos < cfg.blockSize; pos++) {
      const logits = gptNumbers(p, cfg, seq[pos], pos, keys, values);
      const next = choice(softmaxNums(logits.map(l => l * (1 / temperature))), st.sampleRng);
      seq.push(next);
      if (next === tok.bos) break;
    }
    tokens.push(seq);
  }
  return { tokens, text: tokens.map(t => tok.decode(t)) };
}
