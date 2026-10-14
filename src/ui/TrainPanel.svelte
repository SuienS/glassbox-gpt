<script lang="ts">
  import LossChart from './LossChart.svelte';
  import type { Session } from './session.svelte';
  import { formatDuration, formatMs } from './lib/format';

  let { session }: { session: Session } = $props();

  const total = $derived(session.run?.numSteps ?? 0);
  const left = $derived(session.msPerStep ? (total - session.step) * session.msPerStep : NaN);

  // Announced to screen readers; the step counter below is not, as it changes ten times a second.
  const phase = $derived.by(() => {
    switch (session.status) {
      case 'idle': return session.run ? 'Building the model...' : 'Waiting for a dataset';
      case 'ready': return 'Ready to train';
      case 'running': return 'Training';
      case 'paused': return `Paused at step ${session.step.toLocaleString('en')}`;
      case 'done': return 'Finished';
      case 'error': return 'Stopped';
    }
  });

  function toggle() {
    if (session.status === 'running') session.pause();
    else session.start();
  }
</script>

<div class="flex items-center gap-2">
  <button
    class="btn btn-primary min-w-24"
    onclick={toggle}
    disabled={!['ready', 'running', 'paused'].includes(session.status)}
  >
    {session.status === 'running' ? 'Pause' : session.status === 'paused' ? 'Resume' : 'Train'}
  </button>
  <button class="btn" onclick={() => session.reset()} disabled={!session.run || session.status === 'idle'}>Reset</button>
  <p class="ml-auto text-sm" aria-live="polite">{phase}</p>
</div>

{#if session.error}
  <p class="mt-3 text-sm text-danger" role="alert">{session.error}</p>
{/if}

<div class="mt-4">
  <div class="h-1 overflow-hidden rounded-full bg-line">
    <div class="h-full bg-accent" style:width="{total ? (100 * session.step) / total : 0}%"></div>
  </div>
  <p class="mt-1.5 flex justify-between font-mono text-xs text-muted tabular-nums">
    <span>step {session.step.toLocaleString('en')} / {total.toLocaleString('en')}</span>
    {#if session.msPerStep}
      <span>{formatMs(session.msPerStep)}/step{#if session.step < total}{`, ${formatDuration(left)} left`}{/if}</span>
    {/if}
  </p>
</div>

<div class="mt-4">
  <LossChart losses={session.losses} smoothed={session.smoothed} />
</div>
