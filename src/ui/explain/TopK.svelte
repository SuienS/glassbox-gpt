<script lang="ts">
  import { type Candidate, pct } from '../lib/explain';

  let { candidates, c, cPrime, temperature, label, onCompare }: {
    candidates: Candidate[];
    c: number;
    cPrime: number | null;
    temperature: number;
    label: (token: number) => string;
    onCompare: (token: number | null) => void;
  } = $props();

  const showT = $derived(temperature !== 1);
</script>

<table class="w-full text-sm">
  <thead>
    <tr class="text-left text-xs text-muted">
      <th class="pb-1.5 font-normal">Next</th>
      <th class="pb-1.5 font-normal">Model (T = 1)</th>
      {#if showT}<th class="pb-1.5 text-right font-normal">Sampled (T = {temperature.toFixed(1)})</th>{/if}
      <th class="pb-1.5"><span class="sr-only">Compare</span></th>
    </tr>
  </thead>
  <tbody>
    {#each candidates as k (k.token)}
      <tr class="border-t border-line">
        <td class="w-12 py-1.5 font-mono text-[15px]" class:text-accent={k.token === c}>{label(k.token)}</td>
        <td class="py-1.5 pr-3">
          <div class="flex items-center gap-2">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div class="h-full rounded-full" class:bg-accent={k.token === c} class:bg-muted={k.token !== c} style:width="{k.p * 100}%"></div>
            </div>
            <span class="w-9 text-right font-mono text-xs tabular-nums">{pct(k.p)}</span>
          </div>
        </td>
        {#if showT}<td class="py-1.5 pr-3 text-right font-mono text-xs text-muted tabular-nums">{pct(k.pT ?? 0)}</td>{/if}
        <td class="w-24 py-1.5 text-right">
          {#if k.token === c}
            <span class="text-xs text-muted">chosen</span>
          {:else}
            <button
              class="cursor-pointer rounded px-1.5 py-0.5 text-xs text-muted hover:bg-canvas hover:text-ink
                aria-pressed:bg-warn aria-pressed:text-panel"
              aria-pressed={cPrime === k.token}
              aria-label="Why {label(c)} and not {label(k.token)}?"
              onclick={() => onCompare(cPrime === k.token ? null : k.token)}
            >{cPrime === k.token ? 'comparing' : 'compare'}</button>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>
