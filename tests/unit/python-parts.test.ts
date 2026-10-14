import { expect, test } from 'vitest';
import source from '../../reference/microgpt.py?raw';
import { PARTS, partById } from '../../src/ui/python/parts';

const lines = source.split('\n');
const text = (id: string) => partById(id)!.lines.flatMap(([a, b]) => lines.slice(a - 1, b)).join('\n');

// If microgpt.py is ever updated, these catch line ranges that no longer point at the right code.
test.each([
  ['dataset', ['docs = [line.strip()', 'random.shuffle(docs)']],
  ['tokenizer', ['uchars = sorted', 'BOS = len(uchars)']],
  ['settings', ['random.seed(42)', 'n_layer = 1', 'block_size = 16', 'n_head = 4', 'num_steps = 1000']],
  ['autograd', ['class Value', 'def backward(self)', 'child.grad += local_grad * v.grad']],
  ['model', ['def gpt(token_id', 'return logits']],
  ['attention', ['attn_weights = softmax(attn_logits)', "x = linear(x_attn, state_dict[f'layer{li}.attn_wo'])"]],
  ['softmax', ['def softmax(logits)', "logits = linear(x, state_dict['lm_head'])"]],
  ['training', ['loss.backward()', 'lr_t = learning_rate']],
  ['sampling', ['temperature = 0.5', 'random.choices']],
])('%s points at the right lines', (id, snippets) => {
  for (const s of snippets) expect(text(id)).toContain(s);
});

test('ranges are in order and inside the file', () => {
  for (const p of PARTS) {
    for (const [a, b] of p.lines) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(a);
      expect(b).toBeLessThanOrEqual(lines.length);
      expect(lines[a - 1].trim()).not.toBe('');
    }
  }
});
