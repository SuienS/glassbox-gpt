import { type Config, DEFAULT_CONFIG } from '../engine/model';
import { targetFor } from '../explain/targets';
import type { Explanation, FromExplain, FromTrain, ToExplain, ToTrain } from '../workers/protocol';
import { type Device, LIMITS } from './lib/limits';
import { extendEma } from './lib/loss';
import { DEFAULT_SEED, DEFAULT_STEPS } from './lib/presets';

export type Send<T> = (msg: T, transfer?: Transferable[]) => void;
export type Status = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error';

export interface Run { config: Config; docs: string[]; numSteps: number; seed: number }
export interface Sample { step: number; temperature: number; tokens: number[]; text: string }
export interface Target { step: number; temperature: number; tokens: number[]; t: number; c: number }
export interface Deletion { step: number; p: number; salientDrop: number; randomDrop: number; randomStd: number }

const MAX_SAMPLES = 50;
export const DELETION_K = 2;

const sameConfig = (a: Config, b: Config) =>
  a.nEmbd === b.nEmbd && a.nHead === b.nHead && a.nLayer === b.nLayer && a.blockSize === b.blockSize;

// Owns the app state and routes messages between the UI and the two workers.
// The workers never talk to each other: snapshots pass through here on their way to the explainer.
export class Session {
  status = $state<Status>('idle');
  error = $state<string | null>(null);
  run = $state.raw<Run | null>(null);
  datasetName = $state('');
  device = $state<Device>('desktop');

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
  cPrime = $state<number | null>(null); // the rival character for "why c and not c'"
  viewStep = $state<number | null>(null); // the snapshot the pinned character is explained with
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
  #explanations = new Map<string, Explanation>(); // for the pinned character, by step and rival
  #deletions = new Map<number, Deletion>(); // by step
  #inFlight: {
    explain: { id: number; step: number; key: string } | null;
    deletion: { id: number; step: number } | null;
  } = { explain: null, deletion: null };

  constructor(train: Send<ToTrain>, explain: Send<ToExplain>) {
    this.#train = train;
    this.#explain = explain;
  }

  get limits() { return LIMITS[this.device]; }
  get vocabSize() { return this.bos + 1; }
  get canSample() { return this.status === 'ready' || this.status === 'running' || this.status === 'paused' || this.status === 'done'; }

  init(run: Run) {
    run = $state.snapshot(run);
    // Same model shape, so the last speed still gives a fair time estimate.
    if (!this.run || !sameConfig(this.run.config, run.config)) this.msPerStep = 0;
    this.run = run;
    this.status = 'idle';
    this.error = null;
    this.step = 0;
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

  // New training text, keeping the current model settings.
  useDocs(name: string, docs: string[]) {
    this.datasetName = name;
    const base = this.run ?? { config: DEFAULT_CONFIG, numSteps: DEFAULT_STEPS, seed: DEFAULT_SEED };
    this.init({ config: base.config, numSteps: base.numSteps, seed: base.seed, docs });
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

  clearSamples() {
    this.samples = [];
  }

  // k indexes sample.tokens; see targetFor.
  pin(sample: Sample, k: number) {
    const { t, c } = targetFor(sample.tokens, k);
    this.unpin();
    this.target = { step: sample.step, temperature: sample.temperature, tokens: sample.tokens, t, c };
    this.showStep(sample.step);
  }

  // Compare the pinned character against cPrime, or stop comparing with null.
  compare(cPrime: number | null) {
    if (!this.target || cPrime === this.target.c) return;
    this.cPrime = cPrime;
    this.explainError = null;
    this.#refresh();
  }

  // Explains the pinned character with the weights from any snapshot, not just the one that sampled it.
  showStep(step: number) {
    if (!this.target) return;
    this.viewStep = step;
    this.explainError = null;
    this.#refresh();
  }

  unpin() {
    this.target = null;
    this.cPrime = null;
    this.viewStep = null;
    this.explanation = null;
    this.deletion = null;
    this.explaining = this.deleting = false;
    this.explainError = null;
    this.#explanations.clear();
    this.#deletions.clear();
    this.#inFlight = { explain: null, deletion: null };
  }

  // Shows cached results for viewStep and asks the explainer for whatever is missing. The worker can't
  // cancel work, so only one request of each kind is in flight; each reply runs this again for wherever
  // the timeline is by then, and fast scrubbing never builds a queue.
  #refresh() {
    const tg = this.target, step = this.viewStep;
    if (!tg || step === null) return;

    const key = `${step}/${this.cPrime ?? ''}`;
    const result = this.#explanations.get(key);
    this.explaining = !result;
    if (result) {
      this.explanation = { step, result };
    } else if (!this.#inFlight.explain) {
      const id = ++this.#nextId;
      this.#inFlight.explain = { id, step, key };
      this.#explain({ type: 'explain', id, step, tokens: tg.tokens, t: tg.t, c: tg.c, cPrime: this.cPrime ?? undefined });
    }

    if (tg.t === 0) return; // nothing earlier to delete
    const deletion = this.#deletions.get(step);
    this.deleting = !deletion;
    if (deletion) {
      this.deletion = deletion;
    } else if (result && !this.#inFlight.deletion) { // explanation first: it is what people are waiting for
      const id = ++this.#nextId;
      this.#inFlight.deletion = { id, step };
      this.#explain({
        type: 'deletion', id, step, tokens: tg.tokens, t: tg.t, c: tg.c,
        k: DELETION_K, trials: Math.min(20, this.limits.trials), seed: 1,
      });
    }
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
      case 'explanation': {
        const req = this.#inFlight.explain;
        if (m.id !== req?.id) return; // asked for an earlier pin
        this.#inFlight.explain = null;
        this.#explanations.set(req.key, m.result);
        break;
      }
      case 'deletionResult': {
        if (m.id !== this.#inFlight.deletion?.id) return;
        this.#inFlight.deletion = null;
        this.#deletions.set(m.step, { step: m.step, p: m.p, salientDrop: m.salientDrop, randomDrop: m.randomDrop, randomStd: m.randomStd });
        break;
      }
      case 'error': {
        const kind = m.id === this.#inFlight.explain?.id ? 'explain' : m.id === this.#inFlight.deletion?.id ? 'deletion' : null;
        if (!kind) return;
        const failed = this.#inFlight[kind]!.step;
        this.#inFlight[kind] = null;
        this.explainError = m.message;
        if (kind === 'explain') this.explaining = false;
        else this.deleting = false;
        if (failed === this.viewStep) return; // asking again would only fail again
        break;
      }
    }
    this.#refresh();
  }
}
