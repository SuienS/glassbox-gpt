export const DEFAULT_STEPS = 1000;
export const DEFAULT_SEED = 42;

export const PRESETS = [{ id: 'names', label: 'Names' }];

export async function loadPreset(id: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}presets/${id}.txt`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
