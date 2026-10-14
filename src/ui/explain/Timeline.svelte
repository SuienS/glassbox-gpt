<script lang="ts">
  let { steps, value, sampleStep, smoothed, onchange }: {
    steps: number[]; // snapshot steps, ascending
    value: number;
    sampleStep: number;
    smoothed: number[]; // smoothed[i] is the smoothed loss after step i + 1
    onchange: (step: number) => void;
  } = $props();

  // The slider moves over snapshot indices: sample batches add steps between the regular ones.
  const index = $derived(Math.max(0, steps.indexOf(value)));
  const lossAt = (step: number) => (step > 0 ? smoothed[step - 1] : undefined);
  const describe = (step: number) => {
    const loss = lossAt(step);
    return loss === undefined ? `step ${step}, before training` : `step ${step}, smoothed loss ${loss.toFixed(2)}`;
  };

  // Smoothed loss at each snapshot, drawn behind the slider so a position reads as "how trained".
  const curve = $derived.by(() => {
    const ys = steps.map(lossAt).map(l => l ?? NaN);
    const known = ys.filter(Number.isFinite);
    if (steps.length < 2 || known.length < 2) return '';
    const lo = Math.min(...known), hi = Math.max(...known);
    return ys
      .map((y, i) => (Number.isFinite(y) ? `${i},${(1 - (y - lo) / (hi - lo || 1)).toFixed(3)}` : null))
      .filter(Boolean)
      .join(' ');
  });

  let frame = 0;
  function input(e: Event & { currentTarget: HTMLInputElement }) {
    const step = steps[Number(e.currentTarget.value)];
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => onchange(step));
  }
</script>

<div>
  <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
    <label for="timeline" class="font-medium">Replay with weights from</label>
    <span class="font-mono text-muted tabular-nums">{describe(value)}</span>
  </div>
  {#if curve}
    <!-- inset by half the slider thumb, so the marker sits above it -->
    <svg class="mx-2 mt-2 block h-6 w-[calc(100%-1rem)] overflow-visible" viewBox="0 0 {steps.length - 1} 1" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={curve} fill="none" class="stroke-muted/60" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      <line x1={index} x2={index} y1="0" y2="1" class="stroke-accent" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
  {/if}
  <input
    id="timeline"
    type="range"
    class="mt-1 w-full accent-accent"
    min="0"
    max={Math.max(0, steps.length - 1)}
    step="1"
    value={index}
    aria-valuetext={describe(value)}
    disabled={steps.length < 2}
    oninput={input}
  />
  <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted">
    <span>Same characters, different weights: see how the reasons changed as the model learned.</span>
    {#if value !== sampleStep}
      <button class="cursor-pointer text-accent hover:underline" onclick={() => onchange(sampleStep)}>
        Back to step {sampleStep}, which wrote this sample
      </button>
    {/if}
  </div>
</div>
