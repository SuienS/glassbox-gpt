<script lang="ts">
  import { interpolateViridis } from 'd3-scale-chromatic';
  import type { Explanation } from '../../workers/protocol';
  import { peak, pct } from '../lib/explain';

  let { result, labels, cell, c, cPrime }: {
    result: Explanation;
    labels: string[]; // one per context position
    cell: number;
    c: string;
    cPrime: string | null;
  } = $props();

  const LABEL_W = 64, TOP = 24, ROW = 18, GAP = 6, BARS = 44, HALF = 26;

  const rows = $derived([
    ...result.attention.map((values, i) => ({ name: `head ${i + 1}`, values, gap: 0 })),
    { name: 'mean', values: result.meanAttention, gap: GAP },
    ...(result.rollout ? [{ name: 'flow', values: result.rollout, gap: GAP }] : []),
  ]);
  const rowY = $derived(rows.map((_, i) => TOP + i * ROW + rows.slice(0, i + 1).reduce((g, r) => g + r.gap, 0)));
  const salTop = $derived(rowY.at(-1)! + ROW + 22);
  const maxSal = $derived(Math.max(...result.saliency, 1e-9));
  const conMid = $derived(salTop + BARS + 22 + HALF);
  const maxCon = $derived(result.contrast ? Math.max(...result.contrast.map(Math.abs), 1e-9) : 1);
  const width = $derived(LABEL_W + labels.length * cell);
  const height = $derived(result.contrast ? conMid + HALF + 4 : salTop + BARS + 4);
  const x = (s: number) => LABEL_W + s * cell;

  // Weights spread thin over long contexts, so colours run from 0 to the largest weight shown.
  const maxAttn = $derived(Math.max(...rows.flatMap(r => r.values), 1e-9));
  const colour = (v: number) => interpolateViridis(v / maxAttn);
  const legend = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(f => interpolateViridis(f)).join(', ')})`;

  const summary = $derived.by(() => {
    const at = (s: number) => `"${labels[s]}" (position ${s})`;
    const parts = [
      `Mean attention is highest on ${at(peak(result.meanAttention))}.`,
      `Saliency is highest on ${at(peak(result.saliency))} at ${pct(result.saliency[peak(result.saliency)])}.`,
    ];
    if (result.contrast && cPrime) parts.push(`Towards "${c}" over "${cPrime}", the strongest push is from ${at(peak(result.contrast))}.`);
    return parts.join(' ');
  });
</script>

<div class="overflow-x-auto">
  <svg {width} {height} role="img" aria-label={summary} class="block font-mono">
    {#each labels as label, s}
      <text
        x={x(s) + cell / 2}
        y={TOP - 8}
        text-anchor="middle"
        class={s === 0 ? 'fill-muted text-[9px]' : 'fill-ink text-[13px]'}
        textLength={s === 0 && cell < 26 ? cell - 2 : undefined}
        lengthAdjust="spacingAndGlyphs"
      >{label}</text>
    {/each}

    {#each rows as row, i}
      <text x={LABEL_W - 8} y={rowY[i] + ROW / 2 + 4} text-anchor="end" class="fill-muted font-sans text-[11px]">{row.name}</text>
      {#each row.values as v, s}
        <rect x={x(s) + 0.5} y={rowY[i] + 0.5} width={cell - 1} height={ROW - 1} rx="2" fill={colour(v)}>
          <title>{row.name}, "{labels[s]}": {v.toFixed(3)}</title>
        </rect>
      {/each}
    {/each}

    <g data-py="autograd">
      <text x={LABEL_W - 8} y={salTop + BARS / 2 + 4} text-anchor="end" class="fill-muted font-sans text-[11px]">saliency</text>
      <line x1={LABEL_W} x2={width} y1={salTop + BARS + 0.5} y2={salTop + BARS + 0.5} class="stroke-line" />
      {#each result.saliency as v, s}
        {@const h = (v / maxSal) * BARS}
        <rect x={x(s) + 3} y={salTop + BARS - h} width={cell - 6} height={h} rx="1.5" class="fill-accent">
          <title>"{labels[s]}": {pct(v)}</title>
        </rect>
        {#if cell >= 22 && v >= 0.01}
          <text x={x(s) + cell / 2} y={salTop + BARS - h - 4} text-anchor="middle" class="fill-muted text-[9px]">{pct(v)}</text>
        {/if}
      {/each}
    </g>

    {#if result.contrast && cPrime}
      <g data-py="autograd">
        <text x={LABEL_W - 8} y={conMid - HALF / 2 + 4} text-anchor="end" class="fill-muted font-sans text-[11px]">for {c}</text>
        <text x={LABEL_W - 8} y={conMid + HALF / 2 + 4} text-anchor="end" class="fill-muted font-sans text-[11px]">for {cPrime}</text>
        <line x1={LABEL_W} x2={width} y1={conMid + 0.5} y2={conMid + 0.5} class="stroke-line" />
        {#each result.contrast as v, s}
          {@const h = (Math.abs(v) / maxCon) * HALF}
          <rect x={x(s) + 3} y={v >= 0 ? conMid - h : conMid + 1} width={cell - 6} height={h} rx="1.5"
            class={v >= 0 ? 'fill-accent' : 'fill-warn'}>
            <title>"{labels[s]}": {v >= 0 ? '+' : ''}{v.toFixed(3)}</title>
          </rect>
        {/each}
      </g>
    {/if}
  </svg>
</div>
<p class="mt-2 flex items-center gap-2 text-[11px] text-muted">
  attention
  <span class="font-mono">0</span>
  <span class="h-2 w-24 rounded-sm" style:background={legend}></span>
  <span class="font-mono">{maxAttn.toFixed(2)}</span>
</p>
