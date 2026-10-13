export interface Tokenizer {
  chars: string[];
  bos: number;
  vocabSize: number;
  encode(doc: string): number[];
  decode(ids: number[]): string;
}

export function tokenizerFromChars(chars: string[]): Tokenizer {
  const index = new Map(chars.map((c, i) => [c, i]));
  const bos = chars.length;
  return {
    chars, bos, vocabSize: chars.length + 1,
    encode: doc => Array.from(doc).map(ch => {
      const id = index.get(ch);
      if (id === undefined) throw new Error(`Unknown character found: ${ch}`);
      return id;
    }),
    decode: ids => ids.filter(i => i !== bos).map(i => chars[i]).join(''),
  };
}

export function buildTokenizer(docs: string[]): Tokenizer {
  const chars = [...new Set(docs.flatMap(d => Array.from(d)))]
    .sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!); // code-point order, like Python
  return tokenizerFromChars(chars);
}

export const parseDocs = (text: string) =>
  text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
