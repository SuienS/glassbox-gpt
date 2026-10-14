// Exponential moving average, continued from where `prev` left off.
export function extendEma(prev: number[], losses: number[]): number[] {
  const out = prev.slice();
  let last = out.at(-1);
  for (const l of losses) out.push((last = last === undefined ? l : 0.95 * last + 0.05 * l));
  return out;
}
