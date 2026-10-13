import { sub, backward } from '../engine/value';
import type { Config } from '../engine/model';
import { loadParams } from '../engine/serialize';
import { recordForward } from './forward';

// Gradient x input of z_c (or z_c - z_c') for each position 0..t, signed.
export function attribute(w: Float64Array, cfg: Config, vocabSize: number, tokens: number[],
                          t: number, c: number, cPrime?: number): number[] {
  const { logits, inputs } = recordForward(loadParams(w, cfg, vocabSize), cfg, tokens, t);
  backward(cPrime === undefined ? logits[c] : sub(logits[c], logits[cPrime]));
  return inputs.map(x => x.reduce((s, xi) => s + xi.data * xi.grad, 0));
}
