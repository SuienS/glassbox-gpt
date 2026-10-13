import { sub, backward } from '../engine/value';
import type { Config } from '../engine/model';
import { loadParams } from '../engine/serialize';
import { recordForward } from './forward';

// Gradient x input of z_c (or z_c - z_c') for each position 0..t, signed, along with the forward pass it came from.
export function attributeWithForward(w: Float64Array, cfg: Config, vocabSize: number, tokens: number[],
                                     t: number, c: number, cPrime?: number) {
  const fwd = recordForward(loadParams(w, cfg, vocabSize), cfg, tokens, t);
  backward(cPrime === undefined ? fwd.logits[c] : sub(fwd.logits[c], fwd.logits[cPrime]));
  return { ...fwd, scores: fwd.inputs.map(x => x.reduce((s, xi) => s + xi.data * xi.grad, 0)) };
}

export const attribute = (w: Float64Array, cfg: Config, vocabSize: number, tokens: number[],
                          t: number, c: number, cPrime?: number): number[] =>
  attributeWithForward(w, cfg, vocabSize, tokens, t, c, cPrime).scores;
