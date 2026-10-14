export const DEFAULT_STEPS = 1000;
export const DEFAULT_SEED = 42;

export async function loadPreset(name: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}presets/${name}.txt`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
