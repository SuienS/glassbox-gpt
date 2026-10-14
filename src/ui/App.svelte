<script lang="ts">
  import ConfigPanel from './ConfigPanel.svelte';
  import DatasetPanel from './DatasetPanel.svelte';
  import ExplainPanel from './ExplainPanel.svelte';
  import Panel from './Panel.svelte';
  import SamplePanel from './SamplePanel.svelte';
  import TrainPanel from './TrainPanel.svelte';
  import { saveDevice } from './lib/limits';
  import type { Session } from './session.svelte';
  import { theme } from './theme.svelte';
  import { startTour, tourSeen } from './tour';
  import { track } from './track';

  let { session }: { session: Session } = $props();

  let pythonOpen = $state(false);
  let part = $state<string | null>('model');
  let toggle = $state<HTMLButtonElement>();
  let aside = $state<HTMLElement>();

  // While the code is open, hovering or focusing a part of the page selects its lines.
  $effect(() => {
    if (!pythonOpen) return;
    const pick = (e: Event) => {
      const id = (e.target as Element).closest?.('[data-py]')?.getAttribute('data-py');
      if (id) part = id;
    };
    document.addEventListener('pointerover', pick);
    document.addEventListener('focusin', pick);
    return () => {
      document.removeEventListener('pointerover', pick);
      document.removeEventListener('focusin', pick);
    };
  });

  function openPython() {
    track('python-open');
    pythonOpen = true;
  }

  function replayTour() {
    track('tour-replay');
    startTour();
  }

  function closePython() {
    pythonOpen = false;
    toggle?.focus();
  }

  // First visit: show the tour once the model is ready to train.
  let tourChecked = false;
  $effect(() => {
    if (tourChecked || session.status !== 'ready') return;
    tourChecked = true;
    if (!tourSeen()) startTour();
  });

  // Dataset and model come with defaults, so after loading the hint jumps to training.
  const next = $derived(
    !session.run ? 1
    : session.step === 0 && session.status !== 'running' ? 3
    : !session.samples.length ? 4
    : !session.target ? 5
    : 0,
  );
</script>

<svelte:window onkeydown={e => e.key === 'Escape' && aside?.contains(document.activeElement) && closePython()} />

<div class="lg:flex">
<div class="min-w-0 flex-1">
<header class="border-b border-line bg-panel">
  <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 class="font-semibold tracking-tight">Glass-box GPT</h1>
      <p class="text-sm text-muted">A tiny GPT trained in your browser, with a reason for every character it writes.</p>
    </div>
    <div class="ml-auto flex gap-2">
      <button
        class="btn px-2 py-1"
        onclick={() => theme.toggle()}
        aria-label={theme.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme.current === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          {#if theme.current === 'dark'}
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          {:else}
            <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
          {/if}
        </svg>
      </button>
      <button class="btn px-2.5 py-1 text-xs" onclick={replayTour}>Tour</button>
      <button
        id="python-toggle"
        bind:this={toggle}
        class="btn px-2.5 py-1 text-xs aria-expanded:border-accent aria-expanded:text-accent"
        aria-expanded={pythonOpen}
        aria-controls="python"
        onclick={() => (pythonOpen ? closePython() : openPython())}
      >Python</button>
    </div>
  </div>
</header>

<main
  class="mx-auto grid max-w-7xl gap-4 px-4 py-6
    {pythonOpen ? 'max-lg:pb-[58vh] 2xl:grid-cols-[22rem_minmax(0,1fr)]' : 'lg:grid-cols-[22rem_minmax(0,1fr)]'}"
>
  <div class="flex min-w-0 flex-col gap-4">
    <Panel id="dataset" py="dataset" step={1} current={next === 1} title="Dataset" note="One example per line. Your text never leaves the browser.">
      <DatasetPanel {session} />
    </Panel>

    <Panel id="config" py="settings" step={2} title="Model" note="Bigger models learn more and train slower.">
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

    <Panel id="train" py="training" step={3} current={next === 3} title="Training">
      <TrainPanel {session} />
    </Panel>
  </div>

  <div class="flex min-w-0 flex-col gap-4">
    <Panel id="samples" py="sampling" step={4} current={next === 4} title="Samples" note="Generate text, then click any character to see why the model wrote it.">
      {#snippet actions()}
        {#if session.samples.length}
          <button class="cursor-pointer text-xs text-muted hover:text-ink" onclick={() => session.clearSamples()}>Clear</button>
        {/if}
      {/snippet}
      <SamplePanel {session} />
    </Panel>

    <Panel id="explain" py="model" step={5} current={next === 5} title="Explanation">
      <ExplainPanel {session} />
    </Panel>
  </div>
</main>

<footer class="mx-auto max-w-7xl px-4 pb-6 text-xs text-muted">
  Built by <a class="text-accent hover:underline" href="https://ravidusilva.com/" target="_blank" rel="noopener">Ravidu Silva</a>
  · <a class="text-accent hover:underline" href="https://github.com/SuienS/glassbox-gpt" target="_blank" rel="noopener">Source on GitHub</a>
</footer>
</div>

{#if pythonOpen}
  <!-- Not modal: the page stays usable, so hovering it can drive the highlight. -->
  <aside
    id="python"
    aria-label="Python source"
    class="fixed inset-x-0 bottom-0 z-20 h-[55vh] border-t border-line bg-panel shadow-lg
      lg:sticky lg:top-0 lg:h-screen lg:w-[32rem] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-none"
    bind:this={aside}
  >
    {#await import('./python/PythonPanel.svelte') then { default: PythonPanel }}
      <PythonPanel {part} onpick={id => (part = id)} onclose={closePython} />
    {/await}
  </aside>
{/if}
</div>
