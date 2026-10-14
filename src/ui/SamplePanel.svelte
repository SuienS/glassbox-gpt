<script lang="ts">
  import type { Sample, Session } from './session.svelte';
  import { charLabel } from './lib/format';

  let { session }: { session: Session } = $props();

  let temperature = $state(0.8);
  let count = $state(5);

  const pinned = (s: Sample, k: number) => session.target?.tokens === s.tokens && session.target.t === k - 1;
  const spoken = (ch: string) => (ch === ' ' ? 'space' : ch);

  function sample(e: SubmitEvent) {
    e.preventDefault();
    session.sample(Math.min(20, Math.max(1, Math.round(count || 1))), temperature);
  }
</script>

<form class="flex flex-wrap items-end gap-x-5 gap-y-3" onsubmit={sample}>
  <label class="grid gap-1 text-xs">
    <span class="flex justify-between">
      Temperature
      <output class="font-mono text-muted tabular-nums">{temperature.toFixed(1)}</output>
    </span>
    <input type="range" min="0.1" max="1.5" step="0.1" bind:value={temperature} class="w-44 accent-accent" />
  </label>
  <label class="grid gap-1 text-xs">
    Count
    <input class="input w-16" type="number" min="1" max="20" bind:value={count} />
  </label>
  <button type="submit" class="btn btn-primary" disabled={!session.canSample}>Sample</button>
  <p class="text-xs text-muted sm:ml-auto">Lower temperature plays it safe; higher takes more risks.</p>
</form>

{#if session.samples.length}
  <ol class="mt-4 max-h-96 divide-y divide-line overflow-y-auto border-y border-line">
    {#each session.samples as s (s)}
      <li class="flex items-baseline gap-3 py-1.5">
        <span class="w-28 shrink-0 font-mono text-[11px] whitespace-nowrap text-muted tabular-nums" title="Training step and temperature">
          step {s.step}, T {s.temperature.toFixed(1)}
        </span>
        <span class="flex min-w-0 flex-wrap items-baseline font-mono">
          {#each s.tokens.slice(1) as tok, i}
            {@const k = i + 1}
            {#if tok === session.bos}
              <button
                class="ml-1.5 cursor-pointer rounded border border-dashed border-line px-1.5 text-[11px] leading-6 text-muted
                  hover:border-muted aria-pressed:border-solid aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
                aria-pressed={pinned(s, k)}
                aria-label="Explain why the sample ended"
                onclick={() => session.pin(s, k)}
              >end</button>
            {:else}
              {@const ch = session.chars[tok]}
              <button
                class="h-7 min-w-3.5 cursor-pointer rounded-sm px-px text-[15px] hover:bg-canvas
                  aria-pressed:bg-accent aria-pressed:text-accent-ink"
                class:text-muted={ch === ' '}
                aria-pressed={pinned(s, k)}
                aria-label={`Explain "${spoken(ch)}", character ${k}`}
                onclick={() => session.pin(s, k)}
              >{charLabel(ch)}</button>
            {/if}
          {/each}
        </span>
      </li>
    {/each}
  </ol>
{:else}
  <p class="mt-4 text-sm text-muted">
    {session.canSample ? 'Nothing sampled yet. Try it before training, then again as the loss falls.' : 'Waiting for the model...'}
  </p>
{/if}
