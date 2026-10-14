export type Theme = 'light' | 'dark';

const KEY = 'glassbox-gpt:theme';
const BAR = { light: '#fafaf9', dark: '#0c0a09' }; // browser UI colour, matches --canvas

const system = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// The page starts with the theme index.html picked; this keeps it in sync afterwards.
class ThemeState {
  current = $state<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!saved()) this.#apply(system());
    });
  }

  toggle() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    try {
      // Choosing what the system already uses means following the system again.
      if (next === system()) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts until the page is closed
    }
    this.#apply(next);
  }

  #apply(t: Theme) {
    this.current = t;
    document.documentElement.dataset.theme = t;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', BAR[t]);
  }
}

export const theme = new ThemeState();
