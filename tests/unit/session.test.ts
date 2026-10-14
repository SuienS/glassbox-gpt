import { expect, test } from 'vitest';
import names from '../../public/presets/names.txt?raw';
import { parseDocs } from '../../src/engine/tokenizer';
import { createExplainer } from '../../src/workers/explainer';
import { createTrainer } from '../../src/workers/trainer';
import type { FromTrain, ToExplain, ToTrain } from '../../src/workers/protocol';
import { DEFAULT_CONFIG } from '../../src/engine/model';
import { DESKTOP, MOBILE } from '../../src/engine/validate';
import { type Run, Session } from '../../src/ui/session.svelte';

const run: Run = { config: { nEmbd: 8, nHead: 2, nLayer: 1, blockSize: 16 }, docs: parseDocs(names).slice(0, 200), numSteps: 30, seed: 3 };

// Both workers run in process. Explainer messages queue until deliver(), so replies can arrive late.
function wired() {
  let s!: Session;
  const train = createTrainer(m => s.fromTrain(m));
  const explain = createExplainer(m => s.fromExplain(m));
  const toExplain: ToExplain[] = [];
  let queue: ToExplain[] = [];
  s = new Session(m => train(m), m => { toExplain.push(m); queue.push(m); });
  const deliver = () => { const q = queue; queue = []; q.forEach(explain); };
  return { s, toExplain, deliver };
}

const until = async (ok: () => boolean) => {
  for (const t0 = Date.now(); !ok(); await new Promise(r => setTimeout(r, 2))) {
    if (Date.now() - t0 > 10_000) throw new Error('timed out');
  }
};

test('init resets the explainer and forwards the step-0 snapshot', () => {
  const { s, toExplain } = wired();
  s.init(run);
  expect(s.status).toBe('ready');
  expect(s.chars.length).toBe(s.bos);
  expect(s.snapshots).toEqual([0]);
  expect(toExplain.map(m => m.type)).toEqual(['reset', 'load']);
  expect(toExplain[1]).toMatchObject({ config: run.config, vocabSize: s.bos + 1, step: 0 });
});

test('a run collects every loss, its moving average and the snapshots', async () => {
  const { s } = wired();
  s.init(run);
  s.start();
  expect(s.status).toBe('running');
  await until(() => s.status === 'done');
  expect(s.step).toBe(30);
  expect(s.losses).toHaveLength(30);
  expect(s.smoothed).toHaveLength(30);
  expect(s.smoothed[0]).toBe(s.losses[0]);
  expect(s.snapshots).toEqual([0, 30]);
});

test('samples keep their temperature; pinning explains and runs the deletion test', () => {
  const { s, deliver } = wired();
  s.init(run);
  s.sample(2, 0.5);
  s.sample(1, 1.2);
  expect(s.samples.map(x => x.temperature)).toEqual([1.2, 0.5, 0.5]);

  const sample = s.samples.find(x => x.tokens.length > 3)!;
  s.pin(sample, 3);
  expect(s.target).toMatchObject({ step: 0, t: 2, c: sample.tokens[3], temperature: sample.temperature });
  expect(s.explaining && s.deleting).toBe(true);
  deliver();
  expect(s.explaining || s.deleting).toBe(false);
  expect(s.explanation!.result.saliency).toHaveLength(3);
  expect(s.deletion!.step).toBe(0);

  s.pin(sample, 1); // t = 0: nothing to delete
  deliver();
  expect(s.explanation!.result.saliency).toHaveLength(1);
  expect(s.deleting).toBe(false);
  expect(s.deletion).toBeNull();
});

test('stale explainer replies are dropped; errors land on the request that failed', () => {
  const { s, toExplain, deliver } = wired();
  s.init(run);
  s.sample(5, 1);
  const sample = s.samples.find(x => x.tokens.length > 2)!;
  s.pin(sample, 2);
  s.compare((s.target!.c + 1) % s.vocabSize);
  deliver();
  expect(toExplain.filter(m => m.type === 'explain')).toHaveLength(2);
  expect(s.explanation!.result.contrast).toBeDefined();

  s.explain(99);
  s.unpin();
  deliver();
  expect(s.explainError).toBeNull();

  s.pin(sample, 2);
  s.explain(99);
  deliver();
  expect(s.explaining).toBe(false);
  expect(s.explainError).toMatch(/No snapshot for step 99/);
  expect(s.deletion).not.toBeNull();
});

test('messages from an earlier run are ignored until the latest init answers', () => {
  const sent: ToTrain[] = [];
  const s = new Session(m => { sent.push(m); }, () => {});
  const ready = (chars: string[]): FromTrain => ({ type: 'ready', numParams: 10, chars, bos: chars.length });
  s.init(run);
  s.init(run);
  s.fromTrain({ type: 'progress', step: 5, losses: [3, 3], msPerStep: 1 });
  s.fromTrain(ready(['a']));
  expect(s.status).toBe('idle');
  s.fromTrain({ type: 'samples', step: 0, tokens: [[1, 0, 1]], text: ['a'] });
  s.fromTrain(ready(['a', 'b']));
  expect(s.status).toBe('ready');
  expect(s.chars).toEqual(['a', 'b']);
  expect(s.losses).toEqual([]);
  expect(s.samples).toEqual([]);
  expect(sent.map(m => m.type)).toEqual(['init', 'init']);
});

test('start, pause and sample only act in states where they make sense', () => {
  const sent: ToTrain[] = [];
  const s = new Session(m => { sent.push(m); }, () => {});
  s.start(); s.pause(); s.sample(1, 1);
  expect(sent).toEqual([]);
  s.init(run);
  s.fromTrain({ type: 'ready', numParams: 10, chars: ['a'], bos: 1 });
  s.pause();
  s.start(); s.start();
  s.pause();
  expect(s.status).toBe('paused');
  expect(sent.map(m => m.type)).toEqual(['init', 'start', 'pause']);
});

test('reset keeps the last speed for the time estimate; a new model shape drops it', () => {
  const s = new Session(() => {}, () => {});
  const ready: FromTrain = { type: 'ready', numParams: 10, chars: ['a'], bos: 1 };
  s.init(run);
  s.fromTrain(ready);
  s.fromTrain({ type: 'progress', step: 5, losses: [3, 3], msPerStep: 2 });
  s.reset();
  expect(s.msPerStep).toBe(2);
  expect(s.step).toBe(0);
  s.init({ ...run, config: { ...run.config, nLayer: 2 } });
  expect(s.msPerStep).toBe(0);
});

test('new training text keeps the model settings, or starts from the defaults', () => {
  const sent: ToTrain[] = [];
  const s = new Session(m => { sent.push(m); }, () => {});
  s.useDocs('Names', ['ana', 'bob']);
  expect(s.datasetName).toBe('Names');
  expect(sent[0]).toMatchObject({ type: 'init', config: DEFAULT_CONFIG, numSteps: 1000, seed: 42, docs: ['ana', 'bob'] });
  s.init(run);
  s.useDocs('mine.txt', ['x']);
  expect(sent[2]).toMatchObject({ type: 'init', config: run.config, numSteps: run.numSteps, seed: run.seed, docs: ['x'] });
});

test('limits follow the chosen device', () => {
  const s = new Session(() => {}, () => {});
  expect(s.limits).toBe(DESKTOP);
  s.device = 'mobile';
  expect(s.limits).toBe(MOBILE);
});

test('a rival character adds a contrast until it is cleared or the pin changes', () => {
  const { s, toExplain, deliver } = wired();
  s.init(run);
  s.sample(5, 1);
  const sample = s.samples.find(x => x.tokens.length > 3)!;
  s.pin(sample, 3);
  const rival = (s.target!.c + 1) % s.vocabSize;
  s.compare(s.target!.c); // comparing with itself is ignored
  expect(s.cPrime).toBeNull();
  s.compare(rival);
  deliver();
  expect(toExplain.filter(m => m.type === 'explain').at(-1)).toMatchObject({ cPrime: rival });
  expect(s.explanation!.result.contrast).toHaveLength(3);
  expect(s.explanation!.result.logitGap).toBeTypeOf('number');

  s.compare(null);
  deliver();
  expect(s.explanation!.result.contrast).toBeUndefined();

  s.compare(rival);
  s.pin(sample, 2);
  expect(s.cPrime).toBeNull();
});
