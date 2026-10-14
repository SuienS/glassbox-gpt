<script lang="ts">
  import type { Sample, Session } from './session.svelte';
  import { charLabel, needsShaping } from './lib/format';

  let { session }: { session: Session } = $props();

  let temperature = $state(0.8);
  let count = $state(5);

  const pinned = (s: Sample, k: number) => session.target?.tokens === s.tokens && session.target.t === k - 1;
  const spoken = (ch: string) => (ch === ' ' ? 'space' : ch);

  // One tab stop for the whole list; arrow keys move between characters (roving tabindex).
  let list = $state<HTMLOListElement>();
  let cursor = $state.raw<{ sample: Sample; k: number } | null>(null); // raw: compared by identity with session.samples
  const active = $derived(
    cursor && session.samples.includes(cursor.sample) ? cursor : session.samples.length ? { sample: session.samples[0], k: 1 } : null,
  );
  const isActive = (s: Sample, k: number) => active?.sample === s && active.k === k;

  function move(e: KeyboardEvent) {
    if (!active) return;
    const rows = session.samples;
    let row = rows.indexOf(active.sample), k = active.k;
    const last = (r: number) => rows[r].tokens.length - 1;
    switch (e.key) {
      case 'ArrowRight': k = Math.min(k + 1, last(row)); break;
      case 'ArrowLeft': k = Math.max(k - 1, 1); break;
      case 'ArrowDown': row = Math.min(row + 1, rows.length - 1); k = Math.min(k, last(row)); break;
      case 'ArrowUp': row = Math.max(row - 1, 0); k = Math.min(k, last(row)); break;
      case 'Home': k = 1; break;
      case 'End': k = last(row); break;
      default: return;
    }
    e.preventDefault();
    cursor = { sample: rows[row], k };
    list?.querySelector<HTMLElement>(`[data-row="${row}"][data-k="${k}"]`)?.focus();
  }

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
  <p id="sample-keys" class="sr-only">Arrow keys move between characters; Enter explains one.</p>
  <ol
    bind:this={list}
    class="mt-4 max-h-96 divide-y divide-line overflow-y-auto border-y border-line"
    aria-label="Samples"
    aria-describedby="sample-keys"
  >
    {#each session.samples as s, row (s)}
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
                tabindex={isActive(s, k) ? 0 : -1}
                data-row={row}
                data-k={k}
                onfocus={() => (cursor = { sample: s, k })}
                onkeydown={move}
                onclick={() => session.pin(s, k)}
              >end</button>
            {:else}
              {@const ch = session.chars[tok]}
              <button
                class="h-7 min-w-3.5 cursor-pointer rounded-sm px-px text-[15px] hover:bg-canvas pointer-coarse:min-w-6
                  aria-pressed:bg-accent aria-pressed:text-accent-ink"
                class:text-muted={ch === ' '}
                aria-pressed={pinned(s, k)}
                aria-label={`Explain "${spoken(ch)}", character ${k}`}
                tabindex={isActive(s, k) ? 0 : -1}
                data-row={row}
                data-k={k}
                onfocus={() => (cursor = { sample: s, k })}
                onkeydown={move}
                onclick={() => session.pin(s, k)}
              >{charLabel(ch)}</button>
            {/if}
          {/each}
          {#if needsShaping(s.text)}
            <span class="ml-3 font-sans text-sm text-muted" title="The sample with its characters joined">{s.text}</span>
          {/if}
        </span>
      </li>
    {/each}
  </ol>
{:else}
  <p class="mt-4 text-sm text-muted">
    {session.canSample ? 'Nothing sampled yet. Try it before training, then again as the loss falls.' : 'Waiting for the model...'}
  </p>
{/if}
