import type { Value } from './value';
import { type Config, type Params, initParams, flatParams } from './model';

export const toFloat64 = (params: Value[]) => Float64Array.from(params, p => p.data);

export function loadParams(w: ArrayLike<number>, cfg: Config, vocabSize: number): Params {
  const p = initParams(cfg, vocabSize);
  const flat = flatParams(p);
  if (flat.length !== w.length) throw new Error(`Snapshot has ${w.length} weights, config needs ${flat.length}`);
  flat.forEach((v, i) => { v.data = w[i]; });
  return p;
}
