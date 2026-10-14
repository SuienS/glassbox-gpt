<script lang="ts">
  import type { Snippet } from 'svelte';

  let { id, py, step, current = false, title, note, actions, children }: {
    id: string;
    py?: string; // the matching part of microgpt.py
    step?: number;
    current?: boolean; // the step to do next
    title: string;
    note?: string;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<section {id} data-py={py} aria-labelledby="{id}-title" class="rounded-lg border border-line bg-panel">
  <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
    <div class="flex gap-2.5">
      {#if step}
        <span
          class="mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums
            {current ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}"
          aria-hidden="true"
        >{step}</span>
      {/if}
      <div>
        <h2 id="{id}-title" class="text-sm font-semibold">
          {#if step}<span class="sr-only">{`Step ${step}${current ? ', next' : ''}: `}</span>{/if}{title}
        </h2>
        {#if note}<p class="mt-0.5 text-xs text-muted">{note}</p>{/if}
      </div>
    </div>
    {@render actions?.()}
  </header>
  <div class="p-4">
    {@render children()}
  </div>
</section>
