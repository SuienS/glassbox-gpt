// Anonymous usage events for GoatCounter: a fixed name, never text from the page.
// Each is sent at most once per visit, so the counts read as "visits that did X".
// If an ad blocker removed the script, goatcounter is missing and nothing happens.

type Event =
  | 'train-start'
  | 'custom-dataset'
  | 'explain-open'
  | 'compare'
  | 'timeline'
  | 'python-open'
  | 'tour-replay';

interface GoatCounter { count(vars: { path: string; title?: string; event?: boolean }): void }

const sent = new Set<Event>();

export function track(event: Event) {
  if (sent.has(event)) return;
  sent.add(event);
  (globalThis as { goatcounter?: GoatCounter }).goatcounter?.count({ path: `glassbox-gpt/${event}`, title: event, event: true });
}
