<script lang="ts">
  import { DEFAULT_CONFIG } from '../engine/model';
  import { validateConfig } from '../engine/validate';
  import { DEFAULT_SEED, DEFAULT_STEPS } from './lib/presets';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();

  const fields = [
    { key: 'nEmbd', label: 'Embedding size', code: 'n_embd' },
    { key: 'nHead', label: 'Attention heads', code: 'n_head' },
    { key: 'nLayer', label: 'Layers', code: 'n_layer' },
    { key: 'blockSize', label: 'Context length', code: 'block_size' },
    { key: 'numSteps', label: 'Training steps', code: 'num_steps' },
    { key: 'seed', label: 'Seed', code: 'seed' },
  ] as const;

  function current() {
    const run = session.run;
    return run
      ? { ...run.config, numSteps: run.numSteps, seed: run.seed }
      : { ...DEFAULT_CONFIG, numSteps: DEFAULT_STEPS, seed: DEFAULT_SEED };
  }

  let draft = $state(current());
  $effect(() => { draft = current(); });

  const errors = $derived.by(() => {
    const { numSteps, seed, ...config } = draft;
    const list = validateConfig(config, numSteps, session.limits);
    if (!Number.isInteger(seed)) list.push('seed must be a whole number.');
    return list;
  });
  const invalid = (key: string) => errors.some(e => e.startsWith(`${key} `));
  // validateConfig names fields by their code names; show the labels instead.
  const readable = (e: string) => {
    for (const f of fields) e = e.replace(new RegExp(`\\b${f.key}\\b`, 'g'), f.label.toLowerCase());
    return e[0].toUpperCase() + e.slice(1);
  };
  const dirty = $derived(fields.some(f => draft[f.key] !== current()[f.key]));
  const running = $derived(session.status === 'running');

  function apply(e: SubmitEvent) {
    e.preventDefault();
    if (!session.run || errors.length) return;
    const { numSteps, seed, ...config } = draft;
    session.init({ docs: session.run.docs, config, numSteps, seed });
  }
</script>

<form onsubmit={apply} novalidate>
  <fieldset disabled={running} class="grid grid-cols-2 gap-x-3 gap-y-3">
    {#each fields as f (f.key)}
      <label class="grid gap-1">
        <span class="flex items-baseline justify-between gap-2 text-xs">
          {f.label}
          <code class="text-[10px] text-muted">{f.code}</code>
        </span>
        <input
          class="input"
          type="number"
          min={f.key === 'seed' ? 0 : 1}
          max={f.key === 'seed' ? undefined : session.limits[f.key]}
          step={f.key === 'numSteps' ? 100 : 1}
          bind:value={draft[f.key]}
          aria-invalid={invalid(f.key)}
        />
      </label>
    {/each}
  </fieldset>

  {#if errors.length}
    <ul class="mt-3 space-y-0.5 text-xs text-danger">
      {#each errors as e}<li>{readable(e)}</li>{/each}
    </ul>
  {/if}

  <div class="mt-4 flex items-center gap-2">
    <button type="submit" class="btn btn-primary" disabled={running || !dirty || errors.length > 0}>Apply</button>
    {#if dirty}
      <button type="button" class="btn" disabled={running} onclick={() => (draft = current())}>Revert</button>
    {/if}
    <p class="ml-auto text-right text-xs text-muted">
      {#if running}
        Pause to change the model.
      {:else if dirty && session.step > 0}
        Applying starts a new run.
      {:else if session.numParams}
        <span class="font-mono text-ink tabular-nums">{session.numParams.toLocaleString('en')}</span> parameters
      {/if}
    </p>
  </div>
</form>
