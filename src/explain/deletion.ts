import type { Config } from '../engine/model';
import { mulberry32, shuffle } from '../engine/rng';
import { checkQuery, probsAtLast } from './forward';
import { attribute } from './attribute';

export interface DeletionRequest { tokens: number[]; t: number; c: number; k: number; trials: number; seed: number }

// Positions to delete: the k most salient, and `trials` random sets of k. BOS (position 0) is never deleted.
export function deletionSets(saliency: number[], t: number, k: number, trials: number, seed: number) {
  const cands = Array.from({ length: t }, (_, i) => i + 1);
  const n = Math.max(0, Math.min(k, cands.length));
  const top = [...cands].sort((a, b) => saliency[b] - saliency[a]).slice(0, n);
  const rng = mulberry32(seed);
  const random = Array.from({ length: trials }, () => shuffle([...cands], rng).slice(0, n));
  return { top, random };
}

export function deletionTest(w: Float64Array, cfg: Config, vocabSize: number, req: DeletionRequest) {
  checkQuery(cfg, vocabSize, req.tokens, req.t, req.c);
  const ctx = req.tokens.slice(0, req.t + 1);
  const pOf = (seq: number[]) => probsAtLast(w, cfg, vocabSize, seq)[req.c];
  const without = (drop: number[]) => ctx.filter((_, i) => !drop.includes(i));

  const p = pOf(ctx);
  const dropOf = (drop: number[]) => p > 0 ? (p - pOf(without(drop))) / p : 0;
  const sal = attribute(w, cfg, vocabSize, ctx, req.t, req.c).map(Math.abs);
  const { top, random } = deletionSets(sal, req.t, req.k, Math.max(1, req.trials), req.seed);

  const drops = random.map(dropOf);
  const randomDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
  const randomStd = Math.sqrt(drops.reduce((a, d) => a + (d - randomDrop) ** 2, 0) / drops.length);
  return { p, salientDrop: dropOf(top), randomDrop, randomStd };
}
