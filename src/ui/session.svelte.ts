import type { Config } from '../engine/model';
import { DESKTOP, type Limits } from '../engine/validate';
import { targetFor } from '../explain/targets';
import type { Explanation, FromExplain, FromTrain, ToExplain, ToTrain } from '../workers/protocol';
import { extendEma } from './lib/loss';

export type Send<T> = (msg: T, transfer?: Transferable[]) => void;
export type Status = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error';

export interface Run { config: Config; docs: string[]; numSteps: number; seed: number }
export interface Sample { step: number; temperature: number; tokens: number[]; text: string }
export interface Target { step: number; temperature: number; tokens: number[]; t: number; c: number }
export interface Deletion { step: number; p: number; salientDrop: number; randomDrop: number; randomStd: number }

const MAX_SAMPLES = 50;

// Owns the app state and routes messages between the UI and the two workers.
// The workers never talk to each other: snapshots pass through here on their way to the explainer.
export class Session {
  status = $state<Status>('idle');
  error = $state<string | null>(null);
  run = $state.raw<Run | null>(null);
  limits = $state.raw<Limits>(DESKTOP);

  step = $state(0);
  msPerStep = $state(0);
  chars = $state.raw<string[]>([]);
  bos = $state(0);
  numParams = $state(0);
  losses = $state.raw<number[]>([]); // losses[i] is the loss at step i + 1
  smoothed = $state.raw<number[]>([]);
  snapshots = $state.raw<number[]>([]); // steps the explainer can use, ascending
  samples = $state.raw<Sample[]>([]); // newest first

  target = $state.raw<Target | null>(null);
  explanation = $state.raw<{ step: number; result: Explanation } | null>(null);
  deletion = $state.raw<Deletion | null>(null);
  explaining = $state(false);
  deleting = $state(false);
  explainError = $state<string | null>(null);

  #train: Send<ToTrain>;
  #explain: Send<ToExplain>;
  #pendingInits = 0;
  #sampleTemps: number[] = [];
  #nextId = 0;
  #latest = { explain: 0, deletion: 0 };

  constructor(train: Send<ToTrain>, explain: Send<ToExplain>) {
    this.#train = train;
    this.#explain = explain;
  }

  get vocabSize() { return this.bos + 1; }
  get canSample() { return this.status === 'ready' || this.status === 'running' || this.status === 'paused' || this.status === 'done'; }

  init(run: Run) {
    run = $state.snapshot(run);
    this.run = run;
    this.status = 'idle';
    this.error = null;
    this.step = 0;
    this.msPerStep = 0;
    this.losses = [];
    this.smoothed = [];
    this.snapshots = [];
    this.samples = [];
    this.#sampleTemps = [];
    this.unpin();
    this.#pendingInits++;
    this.#explain({ type: 'reset' });
    this.#train({ type: 'init', ...run });
  }

  start() {
    if (this.status !== 'ready' && this.status !== 'paused') return;
    this.status = 'running';
    this.#train({ type: 'start' });
  }

  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.#train({ type: 'pause' });
  }

  reset() {
    if (this.run) this.init(this.run);
  }

  sample(count: number, temperature: number) {
    if (!this.canSample) return;
    this.#sampleTemps.push(temperature);
    this.#train({ type: 'sample', count, temperature });
  }

  // k indexes sample.tokens; see targetFor.
  pin(sample: Sample, k: number) {
    const { t, c } = targetFor(sample.tokens, k);
    this.unpin();
    this.target = { step: sample.step, temperature: sample.temperature, tokens: sample.tokens, t, c };
    this.explain(sample.step);
    this.runDeletion(sample.step);
  }

  unpin() {
    this.target = null;
    this.explanation = null;
    this.deletion = null;
    this.explaining = this.deleting = false;
    this.explainError = null;
    this.#latest = { explain: 0, deletion: 0 };
  }

  explain(step: number, cPrime?: number) {
    const tg = this.target;
    if (!tg) return;
    this.explaining = true;
    this.explainError = null;
    const id = this.#latest.explain = ++this.#nextId;
    this.#explain({ type: 'explain', id, step, tokens: tg.tokens, t: tg.t, c: tg.c, cPrime });
  }

  runDeletion(step: number) {
    const tg = this.target;
    this.deletion = null;
    if (!tg || tg.t === 0) return; // nothing earlier to delete
    this.deleting = true;
    const id = this.#latest.deletion = ++this.#nextId;
    this.#explain({
      type: 'deletion', id, step, tokens: tg.tokens, t: tg.t, c: tg.c,
      k: 2, trials: Math.min(20, this.limits.trials), seed: 1,
    });
  }

  fromTrain(m: FromTrain) {
    // Until the latest init answers, anything else is left over from an earlier run.
    if (this.#pendingInits > 0) {
      if (m.type !== 'ready' && m.type !== 'error') return;
      if (--this.#pendingInits > 0) return;
    }
    switch (m.type) {
      case 'ready':
        this.chars = m.chars;
        this.bos = m.bos;
        this.numParams = m.numParams;
        this.status = 'ready';
        break;
      case 'progress':
        this.step = m.step;
        this.msPerStep = m.msPerStep;
        if (m.losses.length) {
          this.losses = this.losses.concat(m.losses);
          this.smoothed = extendEma(this.smoothed, m.losses);
        }
        break;
      case 'snapshot':
        this.#explain({
          type: 'load', config: this.run!.config, vocabSize: this.vocabSize, step: m.step, weights: m.weights,
        }, [m.weights.buffer as ArrayBuffer]);
        if (!this.snapshots.includes(m.step)) this.snapshots = [...this.snapshots, m.step].sort((a, b) => a - b);
        break;
      case 'samples': {
        const temperature = this.#sampleTemps.shift() ?? 1;
        const fresh = m.tokens.map((tokens, i) => ({ step: m.step, temperature, tokens, text: m.text[i] }));
        this.samples = [...fresh, ...this.samples].slice(0, MAX_SAMPLES);
        break;
      }
      case 'done':
        this.step = m.step;
        this.status = 'done';
        break;
      case 'error':
        this.status = 'error';
        this.error = m.message;
        break;
    }
  }

  fromExplain(m: FromExplain) {
    switch (m.type) {
      case 'explanation':
        if (m.id !== this.#latest.explain) return;
        this.explaining = false;
        this.explanation = { step: m.step, result: m.result };
        break;
      case 'deletionResult':
        if (m.id !== this.#latest.deletion) return;
        this.deleting = false;
        this.deletion = { step: m.step, p: m.p, salientDrop: m.salientDrop, randomDrop: m.randomDrop, randomStd: m.randomStd };
        break;
      case 'error':
        if (m.id === this.#latest.explain) this.explaining = false;
        else if (m.id === this.#latest.deletion) this.deleting = false;
        else return;
        this.explainError = m.message;
        break;
    }
  }
}
