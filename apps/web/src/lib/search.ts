/**
 * Page search over the user's own trackings. Text is folded per character (case, accents and
 * ё/е ignored) so a position in the folded text is a position in the original: that lets matches
 * be highlighted in place.
 */

export function fold(text: string): string {
  let out = "";
  for (const char of text) {
    const base = char.normalize("NFD")[0] ?? char;
    const lower = base.toLowerCase();
    out += lower === "ё" ? "е" : lower.length === 1 ? lower : base;
  }
  return out;
}

/** The words of a query, folded; empty when there is nothing to look for. */
export function searchWords(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Does the text contain every word (in any order)? */
export function matchesAll(text: string, words: string[]): boolean {
  if (words.length === 0) return true;
  const folded = fold(text);
  return words.every((word) => folded.includes(word));
}

/** Offsets of every occurrence of every word in the text, as [start, end) pairs. */
export function findMatches(text: string, words: string[]): Array<[number, number]> {
  const folded = fold(text);
  const found: Array<[number, number]> = [];
  for (const word of words) {
    let from = 0;
    for (;;) {
      const index = folded.indexOf(word, from);
      if (index === -1) break;
      found.push([index, index + word.length]);
      from = index + word.length;
    }
  }
  return found;
}

interface HighlightRegistry {
  set(name: string, value: unknown): void;
  delete(name: string): void;
}
type HighlightConstructor = new (...ranges: Range[]) => unknown;

const NAME = "ojo-search";

/**
 * Highlights the matches inside `root` with the CSS Custom Highlight API: the page is not
 * modified, so React keeps working on it. Browsers without the API just show no highlight.
 * Returns a function that removes the highlight.
 */
export function highlightMatches(root: HTMLElement, words: string[]): () => void {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights;
  const HighlightClass = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
  if (!registry || !HighlightClass || words.length === 0) return () => undefined;

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("input, textarea, script, style, select")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (const [start, end] of findMatches(text, words)) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  registry.set(NAME, new HighlightClass(...ranges));
  return () => registry.delete(NAME);
}
