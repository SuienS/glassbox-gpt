import { expect, test } from 'vitest'
import { Value, add, mul, pow, log, exp, relu, neg, sub, div, sum, dot, backward } from '../../src/engine/value'

test('worked example: L = a*b + a', () => {
  const a = new Value(2), b = new Value(3)
  backward(add(mul(a, b), a))
  expect(a.grad).toBe(4)
  expect(b.grad).toBe(2)
})

const numGrad = (f: (x: number) => number, x: number, h = 1e-6) =>
  (f(x + h) - f(x - h)) / (2 * h)

const ops: Array<[string, (v: Value) => Value, number]> = [
  ['exp', v => exp(v), 0.7],
  ['log', v => log(v), 1.3],
  ['pow -0.5', v => pow(v, -0.5), 2.1],
  ['relu', v => relu(v), 0.4],
]

test.each(ops)('%s matches central differences', (_, op, x0) => {
  const x = new Value(x0)
  backward(op(x))
  const g = numGrad(t => op(new Value(t)).data, x0)
  expect(Math.abs(x.grad - g) / Math.max(1, Math.abs(g))).toBeLessThan(1e-6)
})

const multi: Array<[string, (vs: Value[]) => Value, number[]]> = [
  ['neg', ([a]) => neg(a), [0.9]],
  ['sub', ([a, b]) => sub(a, b), [1.7, -0.4]],
  ['div', ([a, b]) => div(a, b), [1.7, 0.6]],
  ['sum', vs => sum(vs), [0.3, -1.2, 2.5, 0.8]],
  ['dot', vs => dot(vs.slice(0, 3), vs.slice(3)), [0.3, -1.2, 2.5, 0.8, -0.7, 1.1]],
  ['composite', ([a, b, c]) => div(exp(sum([mul(a, b), c])), add(pow(b, 2), 1)), [0.4, -0.9, 0.2]],
]

test.each(multi)('%s matches central differences for every input', (_, op, x0s) => {
  const xs = x0s.map(x => new Value(x))
  backward(op(xs))
  x0s.forEach((_, i) => {
    const g = numGrad(t => op(x0s.map((x, j) => new Value(j === i ? t : x))).data, x0s[i])
    expect(Math.abs(xs[i].grad - g) / Math.max(1, Math.abs(g))).toBeLessThan(1e-6)
  })
})

test('repeated child: dot(x, x) gives 2x', () => {
  const x = [new Value(3)]
  backward(dot(x, x))
  expect(x[0].grad).toBe(6)
})

test('deep chain does not overflow the stack', () => {
  const x = new Value(1)
  let y = x
  for (let i = 0; i < 100_000; i++) y = add(y, 0)
  backward(y)
  expect(x.grad).toBe(1)
})
