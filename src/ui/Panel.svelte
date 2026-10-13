<script lang="ts">
  import type { Snippet } from 'svelte';

  let { id, title, note, actions, children }: {
    id: string;
    title: string;
    note?: string;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<section {id} aria-labelledby="{id}-title" class="rounded-lg border border-line bg-panel">
  <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
    <div>
      <h2 id="{id}-title" class="text-sm font-semibold">{title}</h2>
      {#if note}<p class="mt-0.5 text-xs text-muted">{note}</p>{/if}
    </div>
    {@render actions?.()}
  </header>
  <div class="p-4">
    {@render children()}
  </div>
</section>
