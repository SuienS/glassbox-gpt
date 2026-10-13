import { expect, test, vi } from 'vitest';
import type { FromTrain } from '../../src/workers/protocol';

vi.mock('../../src/engine/train', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/engine/train')>();
  let calls = 0;
  return { ...actual, trainStep: (st: Parameters<typeof actual.trainStep>[0]) => {
    if (++calls > 5) throw new Error('boom');
    return actual.trainStep(st);
  } };
});

const { createTrainer } = await import('../../src/workers/trainer');

test('a failure during training is reported and stops the loop', async () => {
  const msgs: FromTrain[] = [];
  const send = createTrainer(m => { msgs.push(m); });
  send({ type: 'init', config: { nEmbd: 8, nHead: 2, nLayer: 1, blockSize: 8 }, docs: ['ab', 'ba'], seed: 1, numSteps: 100 });
  send({ type: 'start' });
  await new Promise(r => setTimeout(r, 30));
  expect(msgs.filter(m => m.type === 'error')).toEqual([{ type: 'error', message: 'boom' }]);
  const count = msgs.length;
  await new Promise(r => setTimeout(r, 30));
  expect(msgs.length).toBe(count);
});
