<script lang="ts">
  import Panel from './Panel.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const statusText = $derived({
    idle: 'Not started',
    ready: 'Ready to train',
    running: 'Training',
    paused: 'Paused',
    done: 'Finished',
    error: 'Stopped',
  }[session.status]);
</script>

<header class="border-b border-line bg-panel">
  <div class="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
    <h1 class="font-semibold tracking-tight">Glass-box GPT</h1>
    <p class="text-sm text-muted">A tiny GPT trained in your browser, with a reason for every character it writes.</p>
  </div>
</header>

<main class="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
  <div class="flex min-w-0 flex-col gap-4">
    <Panel id="dataset" title="Dataset" note="One example per line. Your text never leaves the browser.">
      <p class="text-sm text-muted">No dataset loaded.</p>
    </Panel>

    <Panel id="config" title="Model" note="Bigger models learn more and train slower.">
      <p class="text-sm text-muted">Load a dataset first.</p>
    </Panel>

    <Panel id="train" title="Training">
      <p class="text-sm text-muted" aria-live="polite">{statusText}</p>
    </Panel>
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    <Panel id="samples" title="Samples" note="Generate text, then click any character to see why the model wrote it.">
      <p class="text-sm text-muted">No samples yet.</p>
    </Panel>

    <Panel id="explain" title="Explanation">
      <div class="grid min-h-48 place-items-center rounded-md border border-dashed border-line">
        <p class="text-sm text-muted">Pick a character in a sample to explain it.</p>
      </div>
    </Panel>
  </div>
</main>
