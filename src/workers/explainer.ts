import type { ToExplain, FromExplain } from './protocol';
import type { Config } from '../engine/model';
import { explain } from '../explain';
import { deletionTest } from '../explain/deletion';

// Caches snapshots by step and answers explain/deletion requests against them.
export function createExplainer(post: (msg: FromExplain) => void): (msg: ToExplain) => void {
  const snaps = new Map<number, Float64Array>();
  let cfg: Config | null = null;
  let vocabSize = 0;

  return m => {
    if (m.type === 'reset') { snaps.clear(); cfg = null; return; }
    if (m.type === 'load') { cfg = m.config; vocabSize = m.vocabSize; snaps.set(m.step, m.weights); return; }
    const w = snaps.get(m.step);
    if (!cfg || !w) { post({ type: 'error', id: m.id, message: `No snapshot for step ${m.step}` }); return; }
    try {
      if (m.type === 'explain') {
        post({ type: 'explanation', id: m.id, step: m.step, result: explain(w, cfg, vocabSize, m.tokens, m.t, m.c, m.cPrime) });
      } else {
        post({ type: 'deletionResult', id: m.id, step: m.step, ...deletionTest(w, cfg, vocabSize, m) });
      }
    } catch (err) {
      post({ type: 'error', id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  };
}
