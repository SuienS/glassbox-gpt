<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_CONFIG } from '../engine/model';
  import { validateText } from '../engine/validate';
  import { formatBytes } from './lib/format';
  import { PRESETS, loadPreset } from './lib/presets';
  import type { Session } from './session.svelte';
  import { track } from './track';

  let { session }: { session: Session } = $props();

  let text = $state('');
  let name = $state('');
  let checked = $state(''); // trails `text` while typing, so big texts aren't re-validated per keystroke
  let error = $state<string | null>(null);
  let loading = $state(false);
  let fileInput: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const blockSize = $derived(session.run?.config.blockSize ?? DEFAULT_CONFIG.blockSize);
  const report = $derived(checked.trim() ? validateText(checked, blockSize, session.limits) : null);
  const inUse = $derived.by(() => {
    const docs = session.run?.docs;
    return !!report && !!docs && docs.length === report.docs.length && docs.every((d, i) => d === report.docs[i]);
  });
  const running = $derived(session.status === 'running');

  function load(value: string, label: string) {
    clearTimeout(timer);
    text = checked = value;
    name = label;
    error = null;
  }

  function edit() {
    name = 'Your text';
    clearTimeout(timer);
    timer = setTimeout(() => (checked = text), 250);
  }

  async function pickPreset(id: string, label: string) {
    loading = true;
    try {
      load(await loadPreset(id), label);
    } catch (err) {
      error = `Couldn't load ${label} (${err instanceof Error ? err.message : err}).`;
    } finally {
      loading = false;
    }
  }

  async function upload() {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // so picking the same file again still fires change
    if (!file) return;
    // Checked before reading, so a huge file is never pulled into memory.
    if (file.size > session.limits.bytes) {
      error = `${file.name} is ${formatBytes(file.size)}; the limit is ${formatBytes(session.limits.bytes)}.`;
      return;
    }
    try {
      load(await file.text(), file.name);
    } catch {
      error = `Couldn't read ${file.name}.`;
    }
  }

  function use() {
    clearTimeout(timer);
    checked = text;
    if (!report || report.errors.length || running) return;
    if (!PRESETS.some(p => p.label === name)) track('custom-dataset');
    session.useDocs(name || 'Your text', report.docs);
  }

  onMount(async () => {
    await pickPreset(PRESETS[0].id, PRESETS[0].label);
    use();
  });
</script>

{#if session.run}
  <p class="text-sm">
    <span class="text-muted">Training on</span> {session.datasetName}
    <span class="text-muted">({session.run.docs.length.toLocaleString('en')} lines{#if session.chars.length}{`, ${session.chars.length} characters`}{/if})</span>
  </p>
{/if}

<div class="mt-3 flex flex-wrap items-center gap-2">
  {#each PRESETS as p (p.id)}
    <button class="btn" onclick={() => pickPreset(p.id, p.label)} disabled={loading}>{p.label}</button>
  {/each}
  <button class="btn" onclick={() => fileInput.click()}>Upload .txt</button>
  <input bind:this={fileInput} type="file" accept=".txt,text/plain" class="hidden" onchange={upload} />
</div>

<textarea
  class="input mt-3 h-36 resize-y text-xs leading-5"
  aria-label="Training text"
  placeholder="Or paste your own: one example per line, such as names, words or short phrases."
  spellcheck="false"
  bind:value={text}
  oninput={edit}
></textarea>

<div class="mt-2 min-h-5 space-y-1 text-xs" aria-live="polite">
  {#if error}
    <p class="text-danger">{error}</p>
  {:else if report}
    {#if !inUse}
      <p class="text-muted">{name}: {report.lines.toLocaleString('en')} lines, {report.vocab} characters</p>
    {/if}
    {#each report.errors as e}<p class="text-danger">{e}</p>{/each}
    {#each report.warnings as w}<p class="text-warn">{w}</p>{/each}
  {/if}
</div>

<div class="mt-3 flex items-center gap-2">
  <button class="btn btn-primary" onclick={use} disabled={!report || report.errors.length > 0 || inUse || running}>
    Use this text
  </button>
  <p class="ml-auto text-right text-xs text-muted">
    {#if inUse}
      In use.
    {:else if running}
      Pause to switch datasets.
    {:else if session.step > 0 && report && !report.errors.length}
      Starts a new run.
    {/if}
  </p>
</div>
