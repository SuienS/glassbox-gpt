import { expect, test } from 'vitest';
import names from '../../public/presets/names.txt?raw';
import { parseDocs } from '../../src/engine/tokenizer';
import { createState, trainStep } from '../../src/engine/train';
import { createTrainer, snapshotEvery } from '../../src/workers/trainer';
import type { FromTrain, ToTrain } from '../../src/workers/protocol';

const docs = parseDocs(names).slice(0, 200);
const config = { nEmbd: 8, nHead: 2, nLayer: 1, blockSize: 16 };
const init = (numSteps: number, d = docs): ToTrain => ({ type: 'init', config, docs: d, seed: 3, numSteps });

type Msg<T extends FromTrain['type']> = Extract<FromTrain, { type: T }>;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function harness() {
  const msgs: FromTrain[] = [];
  const send = createTrainer(m => { msgs.push(m); });
  const of = <T extends FromTrain['type']>(type: T) => msgs.filter((m): m is Msg<T> => m.type === type);
  async function until<T extends FromTrain['type']>(type: T, from = 0): Promise<Msg<T>> {
    for (const t0 = Date.now(); Date.now() - t0 < 10_000; await wait(2)) {
      const m = msgs.slice(from).find((m): m is Msg<T> => m.type === type);
      if (m) return m;
    }
    throw new Error(`timed out waiting for ${type}`);
  }
  return { msgs, send, of, until };
}

function directLosses(numSteps: number, steps: number) {
  const st = createState(config, docs, 3, numSteps);
  return Array.from({ length: steps }, () => trainStep(st));
}

test('init replies ready, then a step-0 snapshot', () => {
  const h = harness();
  h.send(init(100));
  const [ready, snap] = h.msgs as [Msg<'ready'>, Msg<'snapshot'>];
  expect(ready.type).toBe('ready');
  expect(ready.bos).toBe(ready.chars.length);
  expect(snap).toMatchObject({ type: 'snapshot', step: 0 });
  expect(snap.weights.length).toBe(ready.numParams);
});

test('runs to done, reporting every loss once and snapshotting on schedule', async () => {
  const h = harness();
  h.send(init(120));
  h.send({ type: 'start' });
  const done = await h.until('done');
  expect(done.step).toBe(120);
  expect(h.of('snapshot').map(s => s.step)).toEqual([0, 50, 100, 120]);
  const progress = h.of('progress');
  expect(progress.at(-1)!.step).toBe(120);
  expect(progress.flatMap(p => p.losses)).toEqual(directLosses(120, 120));
  expect(h.msgs.at(-1)).toBe(done);

  h.send({ type: 'start' });
  await wait(20);
  expect(h.msgs.at(-1)).toBe(done);
});

test('pause stops training; sampling while paused does not change the run', async () => {
  const h = harness();
  h.send(init(1000));
  h.send({ type: 'start' });
  await wait(30);
  h.send({ type: 'pause' });
  const paused = h.msgs.at(-1) as Msg<'progress'>;
  expect(paused.type).toBe('progress');
  expect(paused.step).toBeGreaterThan(0);
  expect(paused.step).toBeLessThan(1000);

  await wait(80);
  expect(h.msgs.at(-1)).toBe(paused);

  const before = h.msgs.length;
  h.send({ type: 'sample', count: 3, temperature: 0.8 });
  const [snap, samples] = h.msgs.slice(before) as [Msg<'snapshot'>, Msg<'samples'>];
  expect(snap).toMatchObject({ type: 'snapshot', step: paused.step });
  expect(samples).toMatchObject({ type: 'samples', step: paused.step });
  expect(samples.text).toHaveLength(3);

  h.send({ type: 'start' });
  await wait(30);
  h.send({ type: 'pause' });
  const losses = h.of('progress').flatMap(p => p.losses);
  expect(losses).toHaveLength(h.of('progress').at(-1)!.step);
  expect(losses).toEqual(directLosses(1000, losses.length));
});

test('a failure during training is reported and stops the loop', async () => {
  const h = harness();
  h.send(init(10, []));
  h.send({ type: 'start' });
  const err = await h.until('error');
  expect(err.message).toBeTruthy();
  const count = h.msgs.length;
  await wait(20);
  expect(h.msgs.length).toBe(count);
});

test('after reset, start and sample do nothing', async () => {
  const h = harness();
  h.send(init(100));
  h.send({ type: 'reset' });
  const count = h.msgs.length;
  h.send({ type: 'start' });
  h.send({ type: 'sample', count: 1, temperature: 1 });
  await wait(20);
  expect(h.msgs.length).toBe(count);
});

test('snapshot interval keeps a run to about 40 snapshots', () => {
  expect(snapshotEvery(1000)).toBe(50);
  expect(snapshotEvery(5000)).toBe(150);
  for (const n of [10, 1000, 2001, 5000]) expect(Math.floor(n / snapshotEvery(n))).toBeLessThanOrEqual(40);
});
