import names from '../../public/presets/names.txt?raw';
import { DEFAULT_CONFIG, type Config } from '../../src/engine/model';
import { parseDocs } from '../../src/engine/tokenizer';
import { createState, trainStep } from '../../src/engine/train';
import { toFloat64 } from '../../src/engine/serialize';

// A briefly trained model, so explanations have something to explain.
export function trained(cfg: Config = DEFAULT_CONFIG, steps = 100) {
  const st = createState(cfg, parseDocs(names).slice(0, 500), 42, steps);
  for (let i = 0; i < steps; i++) trainStep(st);
  return { cfg, w: toFloat64(st.params), vocabSize: st.tok.vocabSize, tok: st.tok };
}
