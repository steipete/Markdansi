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
};

type PendingBlock =
  | { kind: "table"; committed: boolean; md: string }
  | { kind: "fence"; fence: FenceState; md: string };

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n?/g, "\n");
}

function isFenceStart(line: string): FenceState | null {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^(```+|~~~+)/);
  if (!match?.[1]) return null;
  const token = match[1];
  const char = token[0] === "~" ? "~" : "`";
  return { char, len: token.length };
}

function isFenceEnd(line: string, fence: FenceState): boolean {
  const trimmed = line.trimStart();
  const token = fence.char.repeat(fence.len);
  return trimmed.startsWith(token);
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
      return flushPending() + emitBlankLine();
    }

    // Fence start: flush held header and enter fence mode.
    const fenceStart = isFenceStart(line);
    if (fenceStart) {
      const out = flushPending();
      pending = { kind: "fence", fence: fenceStart, md: `${line}\n` };
      return out;
    }

    // If we held a possible table header, check if this line starts a table.
    if (pending?.kind === "table" && !pending.committed) {
      if (isTableSeparator(line) && looksLikeTableRow(pending.md)) {
        pending = { kind: "table", committed: true, md: `${pending.md}\n${line}\n` };
        return "";
      }
      const out = flushPending();
      return out + processLine(line);
    }

    // Potential table header: delay emission until we see the next line.
    if (looksLikeTableRow(line)) {
      pending = { kind: "table", committed: false, md: line };
      return "";
    }

    // Normal line: render immediately.
    return emitRendered(line);
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

    out += flushPending();

    return out;
  };

  const reset = () => {
    buffer = "";
    blankStreak = 0;
    started = false;
    pending = null;
  };

  return { push, finish, reset };
}
