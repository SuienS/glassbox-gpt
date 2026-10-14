import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';
import { guessDevice, savedDevice } from './ui/lib/limits';
import { Session } from './ui/session.svelte';
import type { FromExplain, FromTrain } from './workers/protocol';

const trainer = new Worker(new URL('./workers/train.worker.ts', import.meta.url), { type: 'module' });
const explainer = new Worker(new URL('./workers/explain.worker.ts', import.meta.url), { type: 'module' });

const session = new Session(
  (msg, transfer = []) => trainer.postMessage(msg, transfer),
  (msg, transfer = []) => explainer.postMessage(msg, transfer),
);
trainer.onmessage = (e: MessageEvent<FromTrain>) => session.fromTrain(e.data);
explainer.onmessage = (e: MessageEvent<FromExplain>) => session.fromExplain(e.data);
session.device = savedDevice() ?? guessDevice(innerWidth, navigator.hardwareConcurrency);
trainer.onerror = () => session.fromTrain({ type: 'error', message: 'The training worker failed to load.' });

mount(App, { target: document.getElementById('app')!, props: { session } });
