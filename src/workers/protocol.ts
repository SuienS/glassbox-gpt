import type { Config } from '../engine/model';

export type ToTrain =
  | { type: 'init'; config: Config; docs: string[]; seed: number; numSteps: number }
  | { type: 'start' } | { type: 'pause' } | { type: 'reset' }
  | { type: 'sample'; count: number; temperature: number };

export type FromTrain =
  | { type: 'ready'; numParams: number; chars: string[]; bos: number }
  | { type: 'progress'; step: number; losses: number[]; msPerStep: number }
  // step is the weights that produced the samples; tokens start with BOS
  | { type: 'samples'; step: number; tokens: number[][]; text: string[] }
  | { type: 'snapshot'; step: number; weights: Float64Array }
  | { type: 'done'; step: number }
  | { type: 'error'; message: string };

export type ToExplain =
  | { type: 'reset' }
  | { type: 'load'; config: Config; vocabSize: number; step: number; weights: Float64Array }
  | { type: 'explain'; id: number; step: number; tokens: number[]; t: number; c: number; cPrime?: number }
  | { type: 'deletion'; id: number; step: number; tokens: number[]; t: number; c: number; k: number; trials: number; seed: number };

export interface Explanation {
  attention: number[][];   // [head][s], last layer
  meanAttention: number[]; // [s], mean over the last layer's heads
  rollout?: number[];      // [s], all layers combined; only when nLayer > 1
  saliency: number[];      // [s], sums to 1
  contrast?: number[];     // [s], signed
  logitGap?: number;       // z_c - z_c' = log p(c) - log p(c')
  topK: Array<{ token: number; p: number }>;
  logits: number[];        // [token], at position t; softmaxNums(logits.map(z => z / T)) gives temperature T
}

export type FromExplain =
  | { type: 'explanation'; id: number; step: number; result: Explanation }
  | { type: 'deletionResult'; id: number; step: number; p: number; salientDrop: number; randomDrop: number; randomStd: number }
  | { type: 'error'; id: number; message: string };
