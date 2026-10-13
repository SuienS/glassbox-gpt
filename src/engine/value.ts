export class Value {
  data: number;
  grad = 0;
  readonly children: Value[];
  readonly localGrads: number[];
  constructor(data: number, children: Value[] = [], localGrads: number[] = []) {
    this.data = data; this.children = children; this.localGrads = localGrads;
  }
}

const lift = (x: Value | number) => (x instanceof Value ? x : new Value(x));

export const add = (a: Value, b: Value | number) => { const B = lift(b); return new Value(a.data + B.data, [a, B], [1, 1]); };
export const mul = (a: Value, b: Value | number) => { const B = lift(b); return new Value(a.data * B.data, [a, B], [B.data, a.data]); };
export const pow = (a: Value, n: number) => new Value(a.data ** n, [a], [n * a.data ** (n - 1)]);
export const log = (a: Value) => new Value(Math.log(a.data), [a], [1 / a.data]);
export const exp = (a: Value) => { const e = Math.exp(a.data); return new Value(e, [a], [e]); };
export const relu = (a: Value) => new Value(Math.max(0, a.data), [a], [a.data > 0 ? 1 : 0]);
export const neg = (a: Value) => mul(a, -1);
export const sub = (a: Value, b: Value | number) => add(a, typeof b === 'number' ? -b : neg(b));
export const div = (a: Value, b: Value | number) => mul(a, typeof b === 'number' ? 1 / b : pow(b, -1));

// Fused nodes
export const sum = (xs: Value[]) =>
  new Value(xs.reduce((s, x) => s + x.data, 0), xs, xs.map(() => 1));

export const dot = (ws: Value[], xs: Value[]) => {
  let s = 0;
  for (let i = 0; i < ws.length; i++) s += ws[i].data * xs[i].data;
  return new Value(s, [...ws, ...xs], [...xs.map(x => x.data), ...ws.map(w => w.data)]);
};

export function backward(root: Value): void {
  const topo: Value[] = [];
  const visited = new Set<Value>();
  const stack: Array<[Value, boolean]> = [[root, false]];
  while (stack.length) {
    const [v, expanded] = stack.pop()!;
    if (expanded) { topo.push(v); continue; }
    if (visited.has(v)) continue;
    visited.add(v);
    stack.push([v, true]);
    for (const c of v.children) if (!visited.has(c)) stack.push([c, false]);
  }
  root.grad = 1;
  for (let i = topo.length - 1; i >= 0; i--) {
    const v = topo[i];
    for (let j = 0; j < v.children.length; j++) v.children[j].grad += v.localGrads[j] * v.grad;
  }
}