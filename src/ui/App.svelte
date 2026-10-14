<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_CONFIG } from '../engine/model';
  import { validateText } from '../engine/validate';
  import ConfigPanel from './ConfigPanel.svelte';
  import ExplainPanel from './ExplainPanel.svelte';
  import Panel from './Panel.svelte';
  import SamplePanel from './SamplePanel.svelte';
  import TrainPanel from './TrainPanel.svelte';
  import { DEFAULT_SEED, DEFAULT_STEPS, loadPreset } from './lib/presets';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  let dataset = $state<{ name: string; lines: number; vocab: number } | null>(null);
  let loadError = $state<string | null>(null);

  onMount(async () => {
    try {
      const report = validateText(await loadPreset('names'), DEFAULT_CONFIG.blockSize, session.limits);
      dataset = { name: 'Names', lines: report.lines, vocab: report.vocab };
      session.init({ config: DEFAULT_CONFIG, docs: report.docs, numSteps: DEFAULT_STEPS, seed: DEFAULT_SEED });
    } catch (err) {
      loadError = `Couldn't load the names dataset (${err instanceof Error ? err.message : err}).`;
    }
  });
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
      {#if dataset}
        <p class="text-sm">
          {dataset.name}
          <span class="text-muted">({dataset.lines.toLocaleString('en')} lines, {dataset.vocab} characters)</span>
        </p>
      {:else if loadError}
        <p class="text-sm text-danger" role="alert">{loadError}</p>
      {:else}
        <p class="text-sm text-muted">Loading...</p>
      {/if}
    </Panel>

    <Panel id="config" title="Model" note="Bigger models learn more and train slower.">
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
