<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import { theme } from './theme.svelte';

  let { losses, smoothed }: { losses: number[]; smoothed: number[] } = $props();

  const HEIGHT = 180;
  let el: HTMLDivElement;
  let plot: uPlot | undefined;
  let hover = $state<number | null>(null);
  const xs: number[] = [];

  function data(): uPlot.AlignedData {
    xs.length = Math.min(xs.length, losses.length);
    while (xs.length < losses.length) xs.push(xs.length + 1);
    return [xs, losses, smoothed];
  }

  // Colours come from the theme tokens, so the chart follows light/dark mode.
  function build() {
    const css = getComputedStyle(el);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const axis: uPlot.Axis = {
      stroke: token('--muted'),
      font: '11px ui-sans-serif, system-ui, sans-serif',
      grid: { stroke: token('--line'), width: 1 },
      ticks: { stroke: token('--line'), width: 1, size: 4 },
    };
    plot?.destroy();
    plot = new uPlot({
      width: el.clientWidth,
      height: HEIGHT,
      scales: { x: { time: false } },
      legend: { show: false },
      cursor: { y: false, drag: { x: false, y: false }, points: { size: 6 } },
      axes: [{ ...axis, size: 30 }, { ...axis, size: 36 }],
      series: [
        {},
        { stroke: token('--muted'), width: 1, alpha: 0.45, points: { show: false } },
        { stroke: token('--accent'), width: 2, points: { show: false } },
      ],
      hooks: { setCursor: [u => { hover = u.cursor.idx ?? null; }] },
    }, data(), el);
  }

  onMount(() => {
    build();
    const resize = new ResizeObserver(() => plot?.setSize({ width: el.clientWidth, height: HEIGHT }));
    resize.observe(el);
    return () => {
      resize.disconnect();
      plot?.destroy();
    };
  });

  // Canvas colours don't follow CSS, so redraw when the theme changes.
  $effect(() => {
    void theme.current;
    untrack(() => plot && build());
  });

  $effect(() => {
    const d = data();
    plot?.setData(d);
  });

  const shown = $derived(hover ?? losses.length - 1);
</script>

<figure>
  <div class="relative">
    <div bind:this={el} role="img" aria-label="Training loss by step"></div>
    {#if !losses.length}
      <p class="absolute inset-0 grid place-items-center text-xs text-muted">The loss curve appears once training starts.</p>
    {/if}
  </div>
  <figcaption class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
    <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-3 bg-muted/50"></span>loss</span>
    <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-3 bg-accent"></span>smoothed</span>
    {#if shown >= 0 && shown < losses.length}
      <span class="ml-auto font-mono tabular-nums">
        step {shown + 1}: {losses[shown].toFixed(3)}, smoothed <span class="text-ink">{smoothed[shown].toFixed(3)}</span>
      </span>
    {/if}
  </figcaption>
</figure>
