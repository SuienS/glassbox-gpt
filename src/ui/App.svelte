<script lang="ts">
  import ConfigPanel from './ConfigPanel.svelte';
  import DatasetPanel from './DatasetPanel.svelte';
  import ExplainPanel from './ExplainPanel.svelte';
  import Panel from './Panel.svelte';
  import SamplePanel from './SamplePanel.svelte';
  import TrainPanel from './TrainPanel.svelte';
  import { saveDevice } from './lib/limits';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
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
      <DatasetPanel {session} />
    </Panel>

    <Panel id="config" title="Model" note="Bigger models learn more and train slower.">
      {#snippet actions()}
        <label class="flex items-center gap-1.5 text-xs text-muted" title="Caps on model size, steps and dataset size">
          Limits
          <select
            class="rounded border border-line bg-panel py-0.5 pr-1 text-xs text-ink"
            bind:value={session.device}
            onchange={() => saveDevice(session.device)}
          >
            <option value="desktop">Desktop</option>
            <option value="mobile">Phone</option>
          </select>
        </label>
      {/snippet}
      <ConfigPanel {session} />
    </Panel>

    <Panel id="train" title="Training">
      <TrainPanel {session} />
    </Panel>
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    <Panel id="samples" title="Samples" note="Generate text, then click any character to see why the model wrote it.">
      {#snippet actions()}
        {#if session.samples.length}
          <button class="cursor-pointer text-xs text-muted hover:text-ink" onclick={() => session.clearSamples()}>Clear</button>
        {/if}
      {/snippet}
      <SamplePanel {session} />
    </Panel>

    <Panel id="explain" title="Explanation">
      <ExplainPanel {session} />
    </Panel>
  </div>
</main>
