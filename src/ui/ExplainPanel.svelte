<script lang="ts">
  import type { Session } from './session.svelte';
  import { charLabel } from './lib/format';

  let { session }: { session: Session } = $props();

  const label = (tok: number) => (tok === session.bos ? '⟨start⟩' : charLabel(session.chars[tok]));
</script>

{#if session.target}
  {@const tg = session.target}
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="font-mono text-lg">
      <span class="text-muted">{tg.tokens.slice(0, tg.t + 1).map(label).join('')}</span><span
        class="rounded bg-accent px-1 text-accent-ink">{tg.c === session.bos ? 'end' : charLabel(session.chars[tg.c])}</span>
    </p>
    <p class="font-mono text-xs text-muted tabular-nums">weights from step {tg.step}, temperature {tg.temperature.toFixed(1)}</p>
  </div>
{:else}
  <div class="grid min-h-48 place-items-center rounded-md border border-dashed border-line">
    <p class="text-sm text-muted">Pick a character in a sample to explain it.</p>
  </div>
{/if}
