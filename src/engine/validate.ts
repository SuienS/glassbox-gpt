import type { Config } from './model';
import { parseDocs } from './tokenizer';

export interface Limits {
  nEmbd: number; nHead: number; nLayer: number; blockSize: number; numSteps: number;
  bytes: number; lines: number; trials: number;
}

export const DESKTOP: Limits = {
  nEmbd: 48, nHead: 8, nLayer: 3, blockSize: 32, numSteps: 5000, bytes: 2 * 1024 * 1024, lines: 50_000, trials: 50,
};
export const MOBILE: Limits = {
  nEmbd: 16, nHead: 4, nLayer: 1, blockSize: 16, numSteps: 1000, bytes: 1024 * 1024, lines: 50_000, trials: 20,
};
export const VOCAB_WARN = 100;

export interface DocsReport { docs: string[]; lines: number; vocab: number; truncated: number; errors: string[]; warnings: string[] }

// For pasted text, or an uploaded file after File.text().
export function validateText(text: string, blockSize: number, limits: Limits = DESKTOP): DocsReport {
  const docs = parseDocs(text);
  const vocab = new Set(docs.flatMap(d => Array.from(d))).size;
  // a doc of length L gives L + 1 predictions; only blockSize of them are trained
  const truncated = docs.filter(d => Array.from(d).length + 1 > blockSize).length;
  const errors: string[] = [];
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > limits.bytes) errors.push(`Text is ${mb(bytes)}; the limit is ${mb(limits.bytes)}.`);
  if (docs.length === 0) errors.push('No non-empty lines found.');
  if (docs.length > limits.lines) errors.push(`Too many lines (${docs.length.toLocaleString('en')}; maximum ${limits.lines.toLocaleString('en')}).`);
  const warnings: string[] = [];
  if (vocab > VOCAB_WARN) warnings.push(`${vocab.toLocaleString('en')} distinct characters will slow training.`);
  if (truncated) {
    const n = truncated.toLocaleString('en');
    warnings.push(`${n} ${truncated === 1 ? 'line exceeds' : 'lines exceed'} the block size and will be cut.`);
  }
  return { docs, lines: docs.length, vocab, truncated, errors, warnings };
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// Without limits, only checks that the model can be built.
export function validateConfig(cfg: Config, numSteps: number, limits?: Limits): string[] {
  const errors: string[] = [];
  const fields: Array<[keyof Config | 'numSteps', number]> = [
    ['nEmbd', cfg.nEmbd], ['nHead', cfg.nHead], ['nLayer', cfg.nLayer], ['blockSize', cfg.blockSize], ['numSteps', numSteps],
  ];
  for (const [name, v] of fields) {
    if (!Number.isInteger(v) || v < 1) errors.push(`${name} must be a positive whole number.`);
    else if (limits && v > limits[name]) errors.push(`${name} is ${v}; the maximum is ${limits[name]}.`);
  }
  if (Number.isInteger(cfg.nEmbd) && Number.isInteger(cfg.nHead) && cfg.nHead > 0 && cfg.nEmbd % cfg.nHead !== 0) {
    errors.push(`nHead (${cfg.nHead}) must divide nEmbd (${cfg.nEmbd}).`);
  }
  return errors;
}
