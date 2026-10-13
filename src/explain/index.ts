import type { Config } from '../engine/model';
import type { Explanation } from '../workers/protocol';
import { loadParams } from '../engine/serialize';
import { checkQuery, recordForward, softmaxNumbers } from './forward';
import { attribute } from './attribute';

// Attention rollout: mix each layer's head-mean attention with the identity (for the residual),
// then chain the layers to see how much each input position can reach position t.
export function rollout(rows: number[][][][], t: number): number[] {
  const mixed = (li: number, i: number) => {
    const heads = rows[i][li];
    const r = new Array<number>(t + 1).fill(0);
    for (const h of heads) h.forEach((a, s) => { r[s] += 0.5 * a / heads.length; });
    r[i] += 0.5;
    const z = r.reduce((a, b) => a + b, 0);
    return r.map(x => x / z);
  };
  const nLayer = rows[0].length;
  let r = mixed(nLayer - 1, t);
  for (let li = nLayer - 2; li >= 0; li--) {
    const next = new Array<number>(t + 1).fill(0);
    r.forEach((ri, i) => { if (ri) mixed(li, i).forEach((a, s) => { next[s] += ri * a; }); });
    r = next;
  }
  return r;
}

export function explain(w: Float64Array, cfg: Config, vocabSize: number,
                        tokens: number[], t: number, c: number, cPrime?: number): Explanation {
  checkQuery(cfg, vocabSize, tokens, t, c, cPrime);
  const { logits, attn, rows } = recordForward(loadParams(w, cfg, vocabSize), cfg, tokens, t);
  const z = logits.map(l => l.data);
  const topK = softmaxNumbers(z).map((p, token) => ({ token, p })).sort((a, b) => b.p - a.p).slice(0, 5);
  const s = attribute(w, cfg, vocabSize, tokens, t, c).map(Math.abs);
  const total = s.reduce((a, b) => a + b, 0) || 1;
  const heads = attn[cfg.nLayer - 1];
  return {
    attention: heads,
    meanAttention: heads[0].map((_, i) => heads.reduce((a, h) => a + h[i], 0) / heads.length),
    rollout: cfg.nLayer > 1 ? rollout(rows, t) : undefined,
    saliency: s.map(x => x / total),
    contrast: cPrime === undefined ? undefined : attribute(w, cfg, vocabSize, tokens, t, c, cPrime),
    logitGap: cPrime === undefined ? undefined : z[c] - z[cPrime],
    topK,
  };
}
