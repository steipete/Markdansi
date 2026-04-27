import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

/**
 * Visible width of a string, ignoring ANSI escape codes.
 */
export function visibleWidth(text: string): number {
  return stringWidth(stripAnsi(text));
}

/**
 * Wrap a single paragraph string into lines respecting visible width.
 * Breaks only on spaces. Words longer than width overflow.
 */
export function wrapText(text: string, width: number, wrap: boolean): string[] {
  if (!wrap || width <= 0) return [text];
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  const trimEndSpaces = (s: string) => s.replace(/\s+$/, "");

  const orphanPhraseTail = (s: string): string | null => {
    const trimmed = trimEndSpaces(s);
    const phrase = trimmed.match(/\b(with|in|on|of|to|for)\s+(a|an|the)$/i);
    if (phrase) {
      const preposition = phrase[1];
      const article = phrase[2];
      if (preposition && article) return `${preposition} ${article}`;
    }

    const single = trimmed.match(/\b(a|an|the|to|of|with|and|or|in|on|for)$/i);
    return single?.[1] ?? null;
  };

  for (const word of words) {
    const w = visibleWidth(word);
    if (current !== "" && currentWidth + w > width && !/^\s+$/.test(word)) {
      const nextWord = word.replace(/^\s+/, "");
      const currentNoTrail = trimEndSpaces(current);
      const tail = orphanPhraseTail(currentNoTrail);
      if (tail && currentNoTrail.length > tail.length) {
        const base = trimEndSpaces(currentNoTrail.slice(0, currentNoTrail.length - tail.length));
        if (base !== "") {
          lines.push(base);
          current = `${tail} ${nextWord}`;
          currentWidth = visibleWidth(current);
          continue;
        }
      }

      lines.push(currentNoTrail);
      current = nextWord;
      currentWidth = visibleWidth(current);
      continue;
    }
    current += word;
    currentWidth = visibleWidth(current);
  }

  if (current !== "") lines.push(trimEndSpaces(current));
  if (lines.length === 0) lines.push("");
  return lines;
}

export function wrapWithPrefix(text: string, width: number, wrap: boolean, prefix = ""): string[] {
  if (!wrap) return text.split("\n").map((line) => prefix + line);
  const out: string[] = [];
  const w = Math.max(1, width - visibleWidth(prefix));
  for (const line of text.split("\n")) {
    const parts = wrapText(line, w, wrap);
    for (const p of parts) out.push(prefix + p);
  }
  return out;
}
