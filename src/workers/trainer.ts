import type { ToTrain, FromTrain } from './protocol';
import { createState, trainStep, type TrainState } from '../engine/train';
import { sample } from '../engine/sample';
import { toFloat64 } from '../engine/serialize';
import { validateConfig } from '../engine/validate';

export type Post = (msg: FromTrain, transfer?: Transferable[]) => void;

const CHUNK_MS = 50;
const PROGRESS_MS = 100;

// Every 50 steps, widened so a long run sends at most about 40 snapshots.
export const snapshotEvery = (numSteps: number) => Math.max(50, Math.ceil(numSteps / 40 / 50) * 50);

// Trains in about 50 ms chunks and yields between them, so pause/sample are handled promptly.
export function createTrainer(post: Post): (msg: ToTrain) => void {
  let st: TrainState | null = null;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: number[] = [];
  let lastPost = 0, lastMs = 0, lastSnapshot = -1, every = 50;

  const stop = () => { clearTimeout(timer); running = false; };

  function fail(err: unknown) {
    stop();
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }

  function snapshot(s: TrainState) {
    if (lastSnapshot === s.step) return;
    const weights = toFloat64(s.params);
    post({ type: 'snapshot', step: s.step, weights }, [weights.buffer]);
    lastSnapshot = s.step;
  }

  function flush(s: TrainState) {
    post({ type: 'progress', step: s.step, losses: pending, msPerStep: lastMs });
    pending = [];
    lastPost = performance.now();
  }

  function loop() {
    if (!running || !st) return;
    try {
      const t0 = performance.now();
      let n = 0;
      while (st.step < st.numSteps && performance.now() - t0 < CHUNK_MS) {
        pending.push(trainStep(st));
        n++;
        if (st.step % every === 0) snapshot(st);
      }
      if (n > 0) lastMs = (performance.now() - t0) / n;
      const finished = st.step >= st.numSteps;
      if (finished || performance.now() - lastPost >= PROGRESS_MS) flush(st);
      if (finished) {
        running = false;
        snapshot(st);
        post({ type: 'done', step: st.step });
      } else {
        timer = setTimeout(loop, 0);
      }
    } catch (err) {
      fail(err);
    }
  }

  return msg => {
    try {
      switch (msg.type) {
        case 'init': {
          stop();
          st = null; pending = []; lastSnapshot = -1; lastMs = 0;
          const problems = validateConfig(msg.config, msg.numSteps);
          if (msg.docs.length === 0) problems.push('No documents to train on.');
          if (problems.length) throw new Error(problems.join(' '));
          st = createState(msg.config, msg.docs, msg.seed, msg.numSteps);
          every = snapshotEvery(msg.numSteps);
          post({ type: 'ready', numParams: st.params.length, chars: st.tok.chars, bos: st.tok.bos });
          snapshot(st);
          break;
        }
        case 'start':
          if (st && !running && st.step < st.numSteps) {
            stop();
            running = true;
            lastPost = performance.now();
            loop();
          }
          break;
        case 'pause':
          // Flush even with no new losses, so the UI learns the exact step it paused at.
          if (st && running) { stop(); flush(st); }
          break;
        case 'reset':
          stop();
          st = null; pending = []; lastSnapshot = -1;
          break;
        case 'sample':
          if (st) {
            snapshot(st); // the explainer needs the exact weights behind these samples
            post({ type: 'samples', step: st.step, ...sample(st, msg.count, msg.temperature) });
          }
          break;
      }
    } catch (err) {
      fail(err);
    }
  };
}
