<script lang="ts">
  import { tick } from 'svelte';
  import source from '../../../reference/microgpt.py?raw';
  import { PARTS, partById } from './parts';

  // The exact revision shown here, so the line numbers match.
  const SOURCE = 'https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95/14fb038816c7aae0bb9342c2dbf1a51dd134a5ff';

  let { part, onpick, onclose }: {
    part: string | null;
    onpick: (id: string) => void;
    onclose: () => void;
  } = $props();

  // Splits off a trailing comment; microgpt.py has no '#' inside strings outside its docstring.
  const DOCSTRING_END = source.split('\n').findIndex((l, i) => i > 0 && l.startsWith('"""'));
  const rows = source.split('\n').map((line, i) => {
    if (i <= DOCSTRING_END) return { code: '', comment: line };
    const hash = line.indexOf('#');
    return hash < 0 ? { code: line, comment: '' } : { code: line.slice(0, hash), comment: line.slice(hash) };
  });

  const active = $derived(partById(part));
  const lit = (n: number) => !!active?.lines.some(([a, b]) => n >= a && n <= b);

  let code = $state<HTMLElement>();
  $effect(() => {
    const first = active?.lines[0][0];
    if (!first) return;
    tick().then(() => {
      // Scroll the code box only; scrollIntoView would also move the page under the pointer.
      const line = code?.querySelector<HTMLElement>(`[data-line="${first}"]`);
      if (!code || !line) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      code.scrollTo({ top: line.offsetTop - code.clientHeight / 3, behavior: reduce ? 'auto' : 'smooth' });
    });
  });
</script>

<div class="flex h-full flex-col">
  <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
    <div>
      <h2 class="text-sm font-semibold">microgpt.py</h2>
      <p class="mt-0.5 text-xs text-muted">
        <a class="text-accent hover:underline" href={SOURCE} target="_blank" rel="noopener">Andrej Karpathy's original</a>,
        unchanged. This app runs the same algorithm in TypeScript.
        Hover or focus a part of the page to see its lines.
      </p>
    </div>
    <button class="btn shrink-0 px-2 py-1 text-xs" onclick={onclose}>Close</button>
  </header>

  <div class="flex flex-wrap gap-1.5 border-b border-line px-4 py-2" role="group" aria-label="Jump to">
    {#each PARTS as p (p.id)}
      <button
        class="cursor-pointer rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-ink
          aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
        aria-pressed={part === p.id}
        onclick={() => onpick(p.id)}
      >{p.label}</button>
    {/each}
  </div>

  <!-- One block per line, so copying keeps the line breaks. Focusable so keyboard users can scroll it. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre bind:this={code} class="relative min-h-0 flex-1 overflow-auto py-2 font-mono text-[12px] leading-5" tabindex="0" aria-label="microgpt.py source"><code>{#each rows as row, i (i)}<span data-line={i + 1} class="block border-l-2 pr-4 {lit(i + 1) ? 'border-accent bg-accent/10' : 'border-transparent'}"><span class="inline-block w-10 pr-3 text-right text-muted/70 select-none">{i + 1}</span>{row.code}<span class="text-muted">{row.comment}</span></span>{/each}</code></pre>
</div>
