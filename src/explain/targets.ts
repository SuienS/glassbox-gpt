// Sample tokens are [BOS, c1, c2, ...]. Clicking ck explains the prediction made at position k - 1, whose context is tokens 0..k-1.
export function targetFor(tokens: number[], k: number) {
  if (!Number.isInteger(k) || k < 1 || k >= tokens.length) throw new RangeError(`No character at index ${k}`);
  return { t: k - 1, c: tokens[k] };
}
