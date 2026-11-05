export type MarkdownStreamerSpacing = "preserve" | "single" | "tight";

export type MarkdownStreamer = {
  /**
   * Push an appended Markdown delta (chunk) into the streamer.
   * Returns ANSI text to write to the terminal (append-only).
   */
  push: (delta: string) => string;
  /**
   * Flush remaining buffered content and finish the stream.
   * Optionally accepts one last delta.
   */
  finish: (finalDelta?: string) => string;
  /**
   * Reset internal state (buffer, fence/table detection, spacing).
   */
  reset: () => void;
};

export type MarkdownStreamerOptions = {
  /**
   * Function used to render a Markdown fragment (block or line) to ANSI.
   * Must be pure (no cursor control) and must not rely on prior terminal state.
   */
  render: (markdown: string) => string;
  /**
   * Hybrid streaming: emit complete lines immediately, but buffer multi-line
   * constructs (fenced code blocks + tables) until they are complete.
   *
   * This is designed for terminal scrollback safety: no in-place redraw, no cursor moves.
   */
  mode?: "hybrid";
  /**
   * Controls how blank lines are emitted.
   * - preserve: emit blank lines exactly as received
   * - single: collapse consecutive blank lines to a single blank line
   * - tight: drop blank lines entirely (dense output)
   */
  spacing?: MarkdownStreamerSpacing;
};

type FenceState = {
  char: "`" | "~";
  len: number;
  closeCap: number;
  child: boolean;
};

type PendingBlock =
  | { kind: "table"; committed: boolean; md: string }
  | { kind: "fence"; fence: FenceState; md: string };

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

function isThematicBreak(line: string): boolean {
  return /^ {0,3}(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/.test(line);
}

// Continuation column is the list marker plus its padding (1-4 spaces).
// A nested fence may sit up to three spaces past that column.
function listContinuationColumn(line: string): number | null {
  if (isThematicBreak(line)) return null;
  const match = /^( {0,3})([-+*]|[0-9]{1,9}[.)])(.*)$/.exec(line);
  const marker = match?.[2];
  if (!match || !marker) return null;
  const markerIndent = match[1]?.length ?? 0;
  const after = match[3] ?? "";
  if (after === "") return markerIndent + marker.length + 1;
  if (after.startsWith("\t")) return markerIndent + marker.length + 1;
  const padding = /^( +)/.exec(after)?.[1]?.length;
  if (!padding) return null;
  return markerIndent + marker.length + (padding > 4 ? 1 : padding);
}

function isFenceStart(line: string, listContent: number | null): FenceState | null {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^(```+|~~~+)/);
  if (!match?.[1]) return null;
  const token = match[1];
  const char = token[0] === "~" ? "~" : "`";
  const leading = line.slice(0, line.length - trimmed.length);
  // Tabs stay openers, matching trimStart, but a tab is not a space indent.
  if (!/^ *$/.test(leading)) {
    return { char, len: token.length, closeCap: 3, child: false };
  }
  const indent = leading.length;
  if (listContent !== null && indent >= listContent && indent <= listContent + 3) {
    return { char, len: token.length, closeCap: listContent + 3, child: true };
  }
  return { char, len: token.length, closeCap: 3, child: false };
}

function isFenceEnd(line: string, fence: FenceState): boolean {
  let index = 0;
  while (index < line.length && index < fence.closeCap && line[index] === " ") index += 1;
  const rest = line.slice(index);
  if (!rest.startsWith(fence.char)) return false;
  let count = 0;
  while (rest[count] === fence.char) count += 1;
  if (count < fence.len) return false;
  return /^[ \t]*$/.test(rest.slice(count));
}

function isTableSeparator(line: string): boolean {
  // Examples:
  // | --- | --- |
  // |:--- | ---:|
  // --- | ---
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);
}

function looksLikeTableRow(line: string): boolean {
  if (!line.includes("|")) return false;
  return /[^\s|]/.test(line);
}

function normalizeRenderedFragment(rendered: string): string {
  // Markdansi intentionally prefixes some blocks (e.g. headings) with a newline when rendering
  // whole documents. For streaming fragments, strip leading newlines to avoid double spacing.
  const trimmedStart = rendered.replace(/^\n+/, "");
  // For fragment streaming, normalize to a single trailing newline so spacing is controlled
  // by the streamer (blank-line collapsing) rather than renderer block heuristics.
  const trimmedEnd = trimmedStart.replace(/\n+$/, "");
  return `${trimmedEnd}\n`;
}

export function createMarkdownStreamer(options: MarkdownStreamerOptions): MarkdownStreamer {
  const render = options.render;
  const spacing: MarkdownStreamerSpacing = options.spacing ?? "single";

  let buffer = "";
  let blankStreak = 0;
  let started = false;

  let pending: PendingBlock | null = null;
  let heldList: string | null = null;
  let listContent: number | null = null;

  const emitBlankLine = () => {
    if (!started) return "";
    if (spacing === "tight") return "";
    if (spacing === "single" && blankStreak >= 1) return "";
    blankStreak += 1;
    return "\n";
  };

  const emitRendered = (markdown: string) => {
    if (!markdown) return "";
    blankStreak = 0;
    started = true;
    return normalizeRenderedFragment(render(markdown));
  };

  const flushPending = () => {
    if (!pending) return "";
    const md = pending.md;
    pending = null;
    return emitRendered(md);
  };

  const flushHeldList = (): string => {
    if (heldList === null) return "";
    const line = heldList;
    heldList = null;
    return emitRendered(line);
  };

  const processLine = (line: string): string => {
    // Fence mode: buffer everything until the closing fence.
    if (pending?.kind === "fence") {
      pending.md += `${line}\n`;
      if (isFenceEnd(line, pending.fence)) {
        return flushPending();
      }
      return "";
    }

    // Committed table mode: buffer table rows; flush when it ends.
    if (pending?.kind === "table" && pending.committed) {
      if (line.trim().length === 0) {
        return flushPending() + emitBlankLine();
      }
      if (!looksLikeTableRow(line)) {
        return flushPending() + processLine(line);
      }
      pending.md += `${line}\n`;
      return "";
    }

    // Blank line: flush any held header and emit spacing.
    if (line.trim().length === 0) {
      return flushHeldList() + flushPending() + emitBlankLine();
    }

    // Fence start: keep a child fence with its list item so render() can nest it.
    const fenceStart = isFenceStart(line, listContent);
    if (fenceStart) {
      if (fenceStart.child && heldList !== null) {
        const item = heldList;
        heldList = null;
        const out = flushPending();
        pending = { kind: "fence", fence: fenceStart, md: `${item}\n${line}\n` };
        return out;
      }
      listContent = null;
      const out = flushHeldList() + flushPending();
      pending = { kind: "fence", fence: fenceStart, md: `${line}\n` };
      return out;
    }

    // If we held a possible table header, check if this line starts a table.
    if (pending?.kind === "table" && !pending.committed) {
      if (isTableSeparator(line) && looksLikeTableRow(pending.md)) {
        const out = flushHeldList();
        pending = { kind: "table", committed: true, md: `${pending.md}\n${line}\n` };
        return out;
      }
      const out = flushHeldList() + flushPending();
      return out + processLine(line);
    }

    // Potential table header: delay emission until we see the next line.
    if (looksLikeTableRow(line)) {
      const out = flushHeldList();
      listContent = null;
      pending = { kind: "table", committed: false, md: line };
      return out;
    }

    const column = listContinuationColumn(line);
    if (column !== null) {
      const out = flushHeldList();
      heldList = line;
      listContent = column;
      return out;
    }

    listContent = null;
    return flushHeldList() + emitRendered(line);
  };

  const push = (delta: string): string => {
    if (!delta) return "";
    buffer += normalizeNewlines(delta);
    let out = "";
    while (true) {
      const idx = buffer.indexOf("\n");
      if (idx < 0) break;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      out += processLine(line);
    }
    return out;
  };

  const finish = (finalDelta?: string): string => {
    let out = "";
    if (finalDelta) out += push(finalDelta);

    if (buffer.length > 0) {
      out += processLine(buffer);
      buffer = "";
    }

    out += flushHeldList();
    out += flushPending();

    return out;
  };

  const reset = () => {
    buffer = "";
    blankStreak = 0;
    started = false;
    pending = null;
    heldList = null;
    listContent = null;
  };

  return { push, finish, reset };
}
