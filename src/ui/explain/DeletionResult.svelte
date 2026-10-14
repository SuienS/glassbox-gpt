<script lang="ts">
  import type { Deletion } from '../session.svelte';
  import { pct, type Verdict } from '../lib/explain';

  let { deletion, verdict, t, k, trials, c, busy }: {
    deletion: Deletion | null;
    verdict: Verdict;
    t: number;
    k: number;
    trials: number;
    c: string;
    busy: boolean;
  } = $props();

  // Drops are relative: 0.6 means p(c) fell by 60%. Negative means it rose.
  const change = (d: number) => (d >= 0 ? `-${pct(d)}` : `+${pct(-d)}`);
  const width = (d: number) => `${Math.min(1, Math.max(0, d)) * 100}%`;
  const chars = (n: number) => (n === 1 ? 'character' : 'characters');
</script>

{#if t === 0}
  <p class="text-sm text-muted">No earlier characters to test.</p>
{:else if !deletion}
  <p class="text-sm text-muted">{busy ? 'Running the deletion test...' : 'No result.'}</p>
{:else}
  <div class="space-y-3 text-sm" class:opacity-60={busy}>
    <p class="text-xs text-muted">
      p({c}) with the full context: <span class="font-mono text-ink tabular-nums">{pct(deletion.p)}</span>
    </p>

    <div>
      <div class="flex justify-between text-xs">
        <span>Without the {k} most salient {chars(k)}</span>
        <span class="font-mono tabular-nums">{change(deletion.salientDrop)}</span>
      </div>
      <div class="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div class="h-full rounded-full bg-accent" style:width={width(deletion.salientDrop)}></div>
      </div>
    </div>

    <div>
      <div class="flex justify-between text-xs">
        <span>Without {k} random {chars(k)} ({trials} tries)</span>
        <span class="font-mono tabular-nums">{change(deletion.randomDrop)} ± {pct(deletion.randomStd)}</span>
      </div>
      <div class="relative mt-1 h-2 rounded-full bg-line">
        <div class="h-full rounded-full bg-muted" style:width={width(deletion.randomDrop)}></div>
        <div
          class="absolute top-1/2 h-px bg-ink"
          style:left={width(deletion.randomDrop - deletion.randomStd)}
          style:right="calc(100% - {width(deletion.randomDrop + deletion.randomStd)})"
        ></div>
      </div>
    </div>

    {#if verdict === 'supported'}
      <p><span class="font-medium text-accent">Holds up.</span> Removing the salient characters hurts more than removing random ones.</p>
    {:else if verdict === 'weak'}
      <p><span class="font-medium text-warn">Weak.</span> Removing the salient characters hurts no more than removing random ones, so read the saliency loosely.</p>
    {:else}
      <p>
        <span class="font-medium text-muted">Inconclusive.</span>
        With only {t} earlier {chars(t)}, salient and random deletions remove the same ones.
      </p>
    {/if}
  </div>
{/if}
