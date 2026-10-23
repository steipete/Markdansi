import ansiRegex from "ansi-regex";
import sliceAnsi from "slice-ansi";
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cjk =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]/u;
const openingPunctuation = /[\p{Ps}\p{Pi}]/u;
const closingPunctuation =
  /[\p{Pe}\p{Pf}、。，．！？：；・ー々ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ,.!?;:%]/u;

type TextRange = { start: number; end: number };

function splitCjkWord(word: string): string[] {
  if (!cjk.test(word)) return [word];
  const parts: string[] = [];
  let current = "";
  let previous = "";
  for (const { segment } of graphemes.segment(word)) {
    if (
      current !== "" &&
      (cjk.test(previous) || cjk.test(segment)) &&
      !openingPunctuation.test(previous) &&
      !closingPunctuation.test(segment)
    ) {
      parts.push(current);
      current = "";
    }
    current += segment;
    previous = segment;
  }
  if (current !== "") parts.push(current);
  return parts;
}

function activeAnsi(codes: string): string {
  if (codes === "") return "";
  // A visible sentinel makes slice-ansi emit only the currently active openers.
  const balanced = sliceAnsi(`${codes}x`, 0, 1);
  return balanced.slice(0, balanced.lastIndexOf("x"));
}

function renderAnsiRanges(text: string, ranges: TextRange[]): string[] {
  let removed = 0;
  const controls = Array.from(text.matchAll(ansiRegex()), (match) => {
    const control = { at: match.index - removed, code: match[0] };
    removed += match[0].length;
    return control;
  });
  let index = 0;
  let sourceOffset = 0;
  let active = "";
  const consumeControls = (end: number, inclusive: boolean) => {
    let codes = "";
    while (index < controls.length) {
      const control = controls[index];
      if (!control || control.at > end || (!inclusive && control.at === end)) break;
      codes += control.code;
      sourceOffset += control.code.length;
      index += 1;
    }
    return codes;
  };

  return ranges.map(({ start, end }, rangeIndex) => {
    const leadingCodes = consumeControls(start, true);
    const sourceStart = start + sourceOffset;
    const lineCodes = consumeControls(end, false);
    const sourceLine = text.slice(sourceStart, end + sourceOffset);
    const trailingCodes = rangeIndex === ranges.length - 1 ? consumeControls(Infinity, true) : "";
    // Replay source controls exactly once; slice-ansi only understands style/link state.
    const line = active + leadingCodes + sourceLine + trailingCodes;
    active = activeAnsi(active + leadingCodes + lineCodes + trailingCodes);
    const balanced = sliceAnsi(`${active}x`, 0, 1);
    return line + balanced.slice(balanced.lastIndexOf("x") + 1);
  });
}

/** Visible width of a string, ignoring ANSI escape codes. */
export function visibleWidth(text: string): number {
  return stringWidth(stripAnsi(text));
}

function wrapRanges(plain: string, width: number): TextRange[] {
  const words = plain
    .split(/(\s+)/)
    .filter((word) => word.length > 0)
    .flatMap(splitCjkWord);
  const lines: TextRange[] = [];
  let current = "";
  let currentWidth = 0;
  let start = 0;
  let offset = 0;

  const orphanPhraseTail = (s: string): string | null => {
    const phrase = s.match(/\b(with|in|on|of|to|for)\s+(a|an|the)$/i);
    if (phrase) return phrase[0];
    return s.match(/\b(a|an|the|to|of|with|and|or|in|on|for)$/i)?.[1] ?? null;
  };

  for (const word of words) {
    const wordStart = offset;
    offset += word.length;
    const w = visibleWidth(word);
    if (current !== "" && currentWidth + w > width && !/^\s+$/.test(word)) {
      const trimmed = current.trimEnd();
      // Orphans apply at whitespace breaks, not inside mixed CJK/Latin text.
      const tail = /\s$/.test(current) ? orphanPhraseTail(trimmed) : null;
      const base = tail ? trimmed.slice(0, -tail.length).trimEnd() : "";
      if (base !== "") {
        lines.push({ start, end: start + base.length });
        start += trimmed.length - (tail?.length ?? 0);
        current = plain.slice(start, offset);
      } else {
        lines.push({ start, end: start + trimmed.length });
        start = wordStart;
        current = word;
      }
      currentWidth = visibleWidth(current);
      continue;
    }
    current += word;
    currentWidth += w;
  }

  if (current !== "") lines.push({ start, end: start + current.trimEnd().length });
  return lines.length ? lines : [{ start: 0, end: 0 }];
}

/**
 * Wrap on spaces and between CJK graphemes, keeping punctuation with its text.
 * Unbreakable words longer than width overflow. Preserve explicit line breaks.
 */
export function wrapText(text: string, width: number, wrap: boolean): string[] {
  if (!wrap || width <= 0) return [text];
  const plain = stripAnsi(text);
  let offset = 0;
  const lines = plain.split("\n").flatMap((line) => {
    const ranges = wrapRanges(line, width).map(({ start, end }) => ({
      start: start + offset,
      end: end + offset,
    }));
    offset += line.length + 1;
    return ranges;
  });
  return text === plain
    ? lines.map(({ start: lineStart, end }) => plain.slice(lineStart, end))
    : renderAnsiRanges(text, lines);
}

export function wrapWithPrefix(text: string, width: number, wrap: boolean, prefix = ""): string[] {
  if (!wrap) return text.split("\n").map((line) => prefix + line);
  const w = Math.max(1, width - visibleWidth(prefix));
  return wrapText(text, w, wrap).map((line) => prefix + line);
}
