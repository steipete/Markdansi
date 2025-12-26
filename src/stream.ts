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

function looksLikeTableHeader(line: string): boolean {
	if (!line.includes("|")) return false;
	return /[^\s|]/.test(line);
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
	const withNewline = trimmedStart.endsWith("\n")
		? trimmedStart
		: `${trimmedStart}\n`;
	return withNewline;
}

export function createMarkdownStreamer(
	options: MarkdownStreamerOptions,
): MarkdownStreamer {
	const render = options.render;
	const spacing: MarkdownStreamerSpacing = options.spacing ?? "single";

	let buffer = "";
	let blankStreak = 0;

	let heldTableHeader: string | null = null;
	let inTable = false;
	let tableBuffer = "";

	let fence: FenceState | null = null;
	let fenceBuffer = "";

	const emitBlankLine = () => {
		if (spacing === "tight") return "";
		if (spacing === "single" && blankStreak >= 1) return "";
		blankStreak += 1;
		return "\n";
	};

	const emitRendered = (markdown: string) => {
		if (!markdown) return "";
		blankStreak = 0;
		return normalizeRenderedFragment(render(markdown));
	};

	const flushHeldHeader = () => {
		if (!heldTableHeader) return "";
		const md = heldTableHeader;
		heldTableHeader = null;
		return emitRendered(md);
	};

	const flushTable = () => {
		if (!inTable) return "";
		inTable = false;
		const md = tableBuffer;
		tableBuffer = "";
		return emitRendered(md);
	};

	const flushFence = () => {
		if (!fence) return "";
		fence = null;
		const md = fenceBuffer;
		fenceBuffer = "";
		return emitRendered(md);
	};

	const processLine = (line: string): string => {
		// Fence mode: buffer everything until the closing fence.
		if (fence) {
			fenceBuffer += `${line}\n`;
			if (isFenceEnd(line, fence)) {
				return flushFence();
			}
			return "";
		}

		// Table mode: buffer table rows; flush when it ends.
		if (inTable) {
			if (line.trim().length === 0) {
				return flushTable() + emitBlankLine();
			}
			if (!looksLikeTableRow(line)) {
				return flushTable() + processLine(line);
			}
			tableBuffer += `${line}\n`;
			return "";
		}

		// Blank line: flush any held header and emit spacing.
		if (line.trim().length === 0) {
			return flushHeldHeader() + emitBlankLine();
		}

		// Fence start: flush held header and enter fence mode.
		const fenceStart = isFenceStart(line);
		if (fenceStart) {
			const out = flushHeldHeader();
			fence = fenceStart;
			fenceBuffer = `${line}\n`;
			// Some fences are single-line in streams (rare). Handle close immediately.
			if (
				isFenceEnd(line, fenceStart) &&
				line.trimStart().match(/^(```+|~~~+)\s*$/)
			) {
				return out + flushFence();
			}
			return out;
		}

		// If we held a possible table header, check if this line starts a table.
		if (heldTableHeader) {
			if (isTableSeparator(line) && looksLikeTableHeader(heldTableHeader)) {
				inTable = true;
				tableBuffer = `${heldTableHeader}\n${line}\n`;
				heldTableHeader = null;
				return "";
			}
			const out = flushHeldHeader();
			return out + processLine(line);
		}

		// Potential table header: delay emission until we see the next line.
		if (looksLikeTableHeader(line)) {
			heldTableHeader = line;
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

		out += flushHeldHeader();
		out += flushFence();
		out += flushTable();

		return out;
	};

	const reset = () => {
		buffer = "";
		blankStreak = 0;
		heldTableHeader = null;
		inTable = false;
		tableBuffer = "";
		fence = null;
		fenceBuffer = "";
	};

	return { push, finish, reset };
}
