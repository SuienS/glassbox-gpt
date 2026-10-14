<script lang="ts">
  import ContextMap from './explain/ContextMap.svelte';
  import DeletionResult from './explain/DeletionResult.svelte';
  import Timeline from './explain/Timeline.svelte';
  import TopK from './explain/TopK.svelte';
  import { candidates, deletionVerdict } from './lib/explain';
  import { charLabel } from './lib/format';
  import { DELETION_K, type Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  let width = $state(0);

  const label = (tok: number) => (tok === session.bos ? 'end' : charLabel(session.chars[tok]));
  // Joined, so scripts with combining marks read naturally.
  const context = (tokens: number[]) => tokens.map(t => (t === session.bos ? '⟨start⟩' : session.chars[t])).join('');

  const tg = $derived(session.target);
  const result = $derived(session.explanation?.result ?? null);
  const columns = $derived(tg ? tg.tokens.slice(0, tg.t + 1).map((tok, s) => (s === 0 ? 'start' : charLabel(session.chars[tok]))) : []);
  const cell = $derived(Math.max(14, Math.min(36, Math.floor((width - 64) / Math.max(1, columns.length)))));
  const top = $derived(result && tg ? candidates(result.logits, tg.c, tg.temperature) : []);
  const k = $derived(tg ? Math.min(DELETION_K, tg.t) : 0);
  const verdict = $derived(tg ? deletionVerdict(tg.t, k, session.deletion) : 'none');
  const others = $derived(Array.from({ length: session.vocabSize }, (_, tok) => tok).filter(tok => tok !== tg?.c));
</script>

{#if tg}
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="font-mono text-lg break-all">
      <span class="text-muted">{context(tg.tokens.slice(0, tg.t + 1))}</span><span
        class="rounded bg-accent px-1 text-accent-ink">{label(tg.c)}</span>
    </p>
    <p class="font-mono text-xs text-muted tabular-nums">sampled at step {tg.step}, temperature {tg.temperature.toFixed(1)}</p>
  </div>

  {#if session.viewStep !== null}
    <div class="mt-4 rounded-md border border-line bg-canvas px-3 py-2.5" data-py="training">
      <Timeline
        steps={session.snapshots}
        value={session.viewStep}
        sampleStep={tg.step}
        smoothed={session.smoothed}
        onchange={step => session.showStep(step)}
      />
    </div>
  {/if}

  {#if session.explainError}
    <p class="mt-3 text-sm text-danger" role="alert">{session.explainError}</p>
  {/if}

  <section class="mt-5" data-py="attention" aria-labelledby="map-title">
    <h3 id="map-title" class="text-xs font-semibold tracking-wide text-muted uppercase">Where it looked, and what pushed it</h3>
    <p class="mt-1 text-xs text-muted">
      Each column is a character the model could see. The coloured rows are attention in the last layer: brighter means more.
      {#if result?.rollout}The <i>flow</i> row combines every layer: where information could flow, not what mattered.{/if}
      Saliency is how much each character pushed this choice, locally (gradient x input); it is not a causal effect.
    </p>
    <div class="mt-3 min-h-24" bind:clientWidth={width} aria-busy={session.explaining}>
      {#if result}
        <div class="transition-opacity motion-reduce:transition-none" class:opacity-50={session.explaining}>
          <ContextMap
            {result}
            labels={columns}
            {cell}
            c={label(tg.c)}
            cPrime={session.cPrime === null ? null : label(session.cPrime)}
          />
        </div>
      {:else if session.explaining}
        <p class="text-sm text-muted">Explaining...</p>
      {/if}
    </div>
  </section>

  <div class="mt-6 grid gap-6 md:grid-cols-2">
    <section data-py="softmax" aria-labelledby="topk-title">
      <h3 id="topk-title" class="text-xs font-semibold tracking-wide text-muted uppercase">What else it considered</h3>
      <p class="mt-1 text-xs text-muted">Compare with another character to see why the model preferred {label(tg.c)}.</p>
      {#if result}
        <div class="mt-3">
          <TopK
            candidates={top}
            c={tg.c}
            cPrime={session.cPrime}
            temperature={tg.temperature}
            {label}
            onCompare={tok => session.compare(tok)}
          />
        </div>
        <label class="mt-3 flex items-center gap-2 text-xs text-muted">
          Compare with
          <select
            class="rounded border border-line bg-panel py-0.5 pr-1 font-mono text-xs text-ink"
            value={session.cPrime ?? ''}
            onchange={e => session.compare(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
          >
            <option value="">nothing</option>
            {#each others as tok (tok)}<option value={tok}>{label(tok)}</option>{/each}
          </select>
        </label>
        {#if result.logitGap !== undefined && session.cPrime !== null}
          <p class="mt-2 text-xs">
            <span class="font-mono">log p({label(tg.c)}) - log p({label(session.cPrime)}) = {result.logitGap.toFixed(2)}</span>:
            {#if result.logitGap >= 0}
              the model rates {label(tg.c)} {Math.exp(result.logitGap).toFixed(1)} times as likely as {label(session.cPrime)}.
            {:else}
              the model rates {label(session.cPrime)} {Math.exp(-result.logitGap).toFixed(1)} times as likely as {label(tg.c)},
              so {label(tg.c)} was the less likely draw.
            {/if}
            In the bars above, blue pushes towards {label(tg.c)} and amber towards {label(session.cPrime)}.
          </p>
        {/if}
      {/if}
    </section>

    <section aria-labelledby="deletion-title" aria-busy={session.deleting}>
      <h3 id="deletion-title" class="text-xs font-semibold tracking-wide text-muted uppercase">Deletion test</h3>
      <p class="mt-1 text-xs text-muted">
        Does p({label(tg.c)}) fall more when the most salient characters are removed than when random ones are?
        Often not on a model this small. Removing characters also shifts the ones after them.
      </p>
      <div class="mt-3">
        <DeletionResult
          deletion={session.deletion}
          {verdict}
          t={tg.t}
          {k}
          trials={Math.min(20, session.limits.trials)}
          c={label(tg.c)}
          busy={session.deleting}
        />
      </div>
    </section>
  </div>
{:else}
  <div class="grid min-h-48 place-items-center rounded-md border border-dashed border-line">
    <p class="text-sm text-muted">Pick a character in a sample to explain it.</p>
  </div>
{/if}
