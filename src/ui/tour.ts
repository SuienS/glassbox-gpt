const KEY = 'glassbox-gpt:tour';

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // storage blocked: the tour will show again next visit
  }
}

// driver.js is only fetched when the tour actually runs.
export async function startTour() {
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  markSeen();
  driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    animate: !still,
    smoothScroll: !still,
    popoverClass: 'tour',
    stagePadding: 6,
    stageRadius: 8,
    // driver.js focuses the close button; start on Next so Enter moves on
    onPopoverRender: popover => requestAnimationFrame(() => popover.nextButton.focus()),
    steps: [
      {
        element: '#dataset',
        popover: {
          title: 'The text it learns from',
          description: 'About 32,000 names are loaded. Pick a preset, upload a .txt or paste your own; it never leaves your browser.',
        },
      },
      {
        element: '#config',
        popover: {
          title: 'The model',
          description: 'The defaults match Karpathy\'s microgpt.py: about 4,000 parameters. Bigger models learn more and train slower.',
        },
      },
      {
        element: '#train',
        popover: {
          title: 'Train it',
          description: 'Press Train and watch the loss fall. With the defaults it takes a few seconds.',
        },
      },
      {
        element: '#samples',
        popover: {
          title: 'Let it write',
          description: 'Sample at any point, even before training. Then click any character to ask why the model wrote it.',
        },
      },
      {
        element: '#explain',
        popover: {
          title: 'Ask why',
          description:
            'Where it looked, which characters pushed the choice, what else it considered, and a test of whether those characters really mattered. The timeline replays it with weights from earlier in training.',
        },
      },
      {
        element: '#python-toggle',
        popover: {
          title: 'Read the code',
          description: 'The original Python, about 200 lines. Hovering a part of the page highlights the lines it comes from.',
        },
      },
    ],
  }).drive();
}
