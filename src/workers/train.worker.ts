import type { ToTrain } from './protocol';
import { createTrainer } from './trainer';

const handle = createTrainer((msg, transfer = []) => postMessage(msg, { transfer }));
onmessage = (e: MessageEvent<ToTrain>) => handle(e.data);
