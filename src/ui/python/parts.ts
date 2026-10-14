// Where each part of the app lives in Karpathy's microgpt.py (1-based, inclusive line ranges).
export interface Part { id: string; label: string; lines: Array<[number, number]> }

export const PARTS: Part[] = [
  { id: 'dataset', label: 'Dataset', lines: [[14, 21]] },
  { id: 'tokenizer', label: 'Tokenizer', lines: [[23, 27]] },
  { id: 'settings', label: 'Settings', lines: [[12, 12], [75, 79], [152, 152]] },
  { id: 'autograd', label: 'Autograd', lines: [[29, 72]] },
  { id: 'model', label: 'Model', lines: [[92, 144]] },
  { id: 'attention', label: 'Attention', lines: [[115, 134]] },
  { id: 'softmax', label: 'Softmax', lines: [[97, 101], [143, 144]] },
  { id: 'training', label: 'Training', lines: [[146, 184]] },
  { id: 'sampling', label: 'Sampling', lines: [[186, 200]] },
];

export const partById = (id: string | null) => PARTS.find(p => p.id === id) ?? null;
