import { expect, test } from 'vitest'
import names from '../../public/presets/names.txt?raw'
import { parseDocs } from '../../src/engine/tokenizer'
import { DEFAULT_CONFIG } from '../../src/engine/model'
import { createState, trainStep } from '../../src/engine/train'

test('loss falls into the mid-2s on names', () => {
  const st = createState(DEFAULT_CONFIG, parseDocs(names), 42, 1000)
  const t0 = performance.now()
  const losses = Array.from({ length: 1000 }, () => trainStep(st))
  const ms = performance.now() - t0
  const head = losses.slice(0, 50).reduce((a, b) => a + b, 0) / 50
  const tail = losses.slice(-50).reduce((a, b) => a + b, 0) / 50
  console.log(`first 50: ${head.toFixed(3)}, last 50: ${tail.toFixed(3)}, ${(ms / 1000).toFixed(2)} ms/step`)
  expect(tail).toBeGreaterThan(2.2)
  expect(tail).toBeLessThan(2.6)
}, 120_000)
