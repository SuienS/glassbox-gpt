import { expect, test } from 'vitest'
import { mulberry32, gauss, shuffle, choice } from '../../src/engine/rng'
import { buildTokenizer, parseDocs } from '../../src/engine/tokenizer'

test('same seed, same stream', () => {
  const a = mulberry32(42), b = mulberry32(42)
  expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b))
})

test('gauss has roughly the right spread', () => {
  const rng = mulberry32(1)
  const xs = Array.from({ length: 20_000 }, () => gauss(rng, 0.08))
  const sd = Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length)
  expect(sd).toBeGreaterThan(0.078)
  expect(sd).toBeLessThan(0.082)
})

test('shuffle is deterministic', () => {
  expect(shuffle([1, 2, 3, 4, 5], mulberry32(7))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(7)))
})

test('choice never picks a zero weight and follows the weights', () => {
  const rng = mulberry32(3)
  const counts = [0, 0, 0]
  for (let i = 0; i < 30_000; i++) counts[choice([1, 0, 3], rng)]++
  expect(counts[1]).toBe(0)
  expect(counts[2] / counts[0]).toBeGreaterThan(2.8)
  expect(counts[2] / counts[0]).toBeLessThan(3.2)
})

test('tokenizer round-trips non-Latin text', () => {
  const docs = parseDocs('emma\r\n\nශ්‍රී ලංකා\n🙂ok\n')
  const tok = buildTokenizer(docs)
  for (const d of docs) expect(tok.decode(tok.encode(d))).toBe(d)
  expect(tok.bos).toBe(tok.vocabSize - 1)
})

test('tokenizer sorts by code point, similarly to Python', () => {
  expect(buildTokenizer(['🙂', 'ｚ', 'a']).chars).toEqual(['a', 'ｚ', '🙂'])
})

test('parseDocs trims and drops blank lines', () => {
  expect(parseDocs('  ann \r\n\n \t\nbob\n')).toEqual(['ann', 'bob'])
})
