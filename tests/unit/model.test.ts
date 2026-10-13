import { expect, test } from 'vitest'
import names from '../../public/presets/names.txt?raw'
import type { Value } from '../../src/engine/value'
import { mulberry32 } from '../../src/engine/rng'
import { parseDocs } from '../../src/engine/tokenizer'
import { DEFAULT_CONFIG, initParams, flatParams, gpt, type Recorder } from '../../src/engine/model'
import { createState, forwardBackward, trainStep } from '../../src/engine/train'
import { sample } from '../../src/engine/sample'
import { toFloat64, loadParams } from '../../src/engine/serialize'

const docs = parseDocs(names).slice(0, 200)

test('default config has 4,192 parameters on a 27-token vocabulary', () => {
  expect(flatParams(initParams(DEFAULT_CONFIG, 27, mulberry32(42))).length).toBe(4192)
})

test('same seed gives the same init, training and samples', () => {
  const run = () => {
    const st = createState(DEFAULT_CONFIG, docs, 7, 100)
    const init = toFloat64(st.params)
    const losses = [trainStep(st), trainStep(st)]
    return { init, losses, samples: sample(st, 3, 0.8).text }
  }
  expect(run()).toEqual(run())
})

test('untrained loss is close to log(vocabSize)', () => {
  const st = createState(DEFAULT_CONFIG, docs, 1, 100)
  expect(Math.abs(forwardBackward(st, docs[0]) - Math.log(st.tok.vocabSize))).toBeLessThan(0.3)
})

test('repeated steps on one document lower its loss', () => {
  const st = createState(DEFAULT_CONFIG, ['emma'], 3, 50)
  const first = trainStep(st)
  for (let i = 0; i < 30; i++) trainStep(st)
  expect(trainStep(st)).toBeLessThan(first * 0.5)
})

test('snapshot round-trips through loadParams', () => {
  const st = createState(DEFAULT_CONFIG, docs, 5, 10)
  const w = toFloat64(st.params)
  expect(toFloat64(flatParams(loadParams(w, DEFAULT_CONFIG, st.tok.vocabSize)))).toEqual(w)
  expect(() => loadParams(w, DEFAULT_CONFIG, st.tok.vocabSize + 1)).toThrow()
})

test('recorder captures normalised inputs and attention for the last position', () => {
  const st = createState(DEFAULT_CONFIG, docs, 9, 10)
  const keys = [[]] as Value[][][], values = [[]] as Value[][][]
  const rec: Recorder = { inputs: [], attn: [] }
  const tokens = [st.tok.bos, ...st.tok.encode('anna')]
  tokens.forEach((t, pos) => gpt(st.p, DEFAULT_CONFIG, t, pos, keys, values, rec))

  expect(rec.inputs.length).toBe(tokens.length)
  for (const x of rec.inputs) {
    const ms = x.reduce((s, v) => s + v.data ** 2, 0) / x.length
    expect(ms).toBeCloseTo(1, 2)
  }
  expect(rec.attn[0].length).toBe(DEFAULT_CONFIG.nHead)
  for (const w of rec.attn[0]) {
    expect(w.length).toBe(tokens.length)
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
  }
})

test('detachNorms leaves the forward pass unchanged', () => {
  const st = createState(DEFAULT_CONFIG, docs, 9, 10)
  const tokens = [st.tok.bos, ...st.tok.encode('anna')]
  const run = (detachNorms: boolean) => {
    const keys = [[]] as Value[][][], values = [[]] as Value[][][]
    const rec: Recorder = { inputs: [], attn: [], detachNorms }
    return tokens.map((t, pos) => gpt(st.p, DEFAULT_CONFIG, t, pos, keys, values, rec).map(l => l.data))
  }
  expect(run(true)).toEqual(run(false))
})

test('samples start with BOS and stay within the block size', () => {
  const st = createState(DEFAULT_CONFIG, docs, 11, 10)
  for (const seq of sample(st, 20, 1).tokens) {
    expect(seq[0]).toBe(st.tok.bos)
    expect(seq.length).toBeLessThanOrEqual(DEFAULT_CONFIG.blockSize + 1)
    expect(seq.slice(1, -1)).not.toContain(st.tok.bos)
  }
})
