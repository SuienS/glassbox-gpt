import type { ToExplain } from './protocol';
import { createExplainer } from './explainer';

const handle = createExplainer(msg => postMessage(msg));
onmessage = (e: MessageEvent<ToExplain>) => handle(e.data);
