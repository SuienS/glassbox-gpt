import { expect, test } from 'vitest';
import { createExplainer } from '../../src/workers/explainer';
import type { FromExplain } from '../../src/workers/protocol';
import { trained } from './fixtures';

const { cfg, w, vocabSize, tok } = trained(undefined, 20);
const tokens = [tok.bos, ...tok.encode('emma')];

function harness() {
  const msgs: FromExplain[] = [];
  const send = createExplainer(m => { msgs.push(m); });
  send({ type: 'load', config: cfg, vocabSize, step: 20, weights: w });
  return { msgs, send };
}

test('answers explain and deletion requests with their ids', () => {
  const { msgs, send } = harness();
  send({ type: 'explain', id: 1, step: 20, tokens, t: 2, c: tokens[3] });
  send({ type: 'deletion', id: 5, step: 20, tokens, t: 2, c: tokens[3], k: 1, trials: 5, seed: 1 });
  expect(msgs.map(m => [m.type, m.id, 'step' in m && m.step])).toEqual([['explanation', 1, 20], ['deletionResult', 5, 20]]);
});

test('unknown steps, bad requests and resets come back as errors', () => {
  const { msgs, send } = harness();
  send({ type: 'explain', id: 1, step: 0, tokens, t: 2, c: tokens[3] });
  send({ type: 'explain', id: 2, step: 20, tokens, t: 9, c: tokens[3] });
  send({ type: 'reset' });
  send({ type: 'explain', id: 3, step: 20, tokens, t: 2, c: tokens[3] });
  expect(msgs.map(m => m.type)).toEqual(['error', 'error', 'error']);
  expect(msgs.map(m => m.id)).toEqual([1, 2, 3]);
});
