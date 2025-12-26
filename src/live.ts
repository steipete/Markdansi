import stringWidth from "string-width";

export type LiveRenderer = {
	render: (input: string) => void;
	finish: (final?: string) => void;
};

export type LiveRendererOptions = {
	/**
	 * Function that converts the current full input into a rendered frame.
	 * Typically this is Markdansi's `render()` or an app-specific wrapper.
	 */
	renderFrame: (input: string) => string;
	/**
	 * Where to write ANSI output (usually `process.stdout.write.bind(process.stdout)`).
	 */
	write: (chunk: string) => void;
	/**
	 * Enable terminal "synchronized output" framing (DEC private mode 2026).
	 * Most terminals ignore this sequence if unsupported.
	 */
	synchronizedOutput?: boolean;
	/**
	 * Hide cursor during live updates.
	 */
	hideCursor?: boolean;
	/**
	 * Terminal width in columns used for row accounting.
	 * If omitted, defaults to 80.
	 */
	width?: number;
	/**
	 * Maximum number of rows to render in-place. If exceeded, live rendering stops.
	 */
	maxRows?: number;
	/**
	 * Render only the last N visual rows (tail mode).
	 */
	tailRows?: number;
	/**
	 * Append new output when the rendered frame only grows (prefix match).
	 * Falls back to live diff rendering when content reflows.
	 */
	appendWhenPossible?: boolean;
	/**
	 * Invoked once when a render exceeds maxRows.
	 */
	onOverflow?: (info: { rows: number; maxRows: number }) => void;
	/**
	 * Clear the previous frame when overflow is detected.
	 */
	clearOnOverflow?: boolean;
	/**
	 * Clear scrollback + screen when overflow is detected.
	 */
	clearScrollbackOnOverflow?: boolean;
};

const BSU = "\u001b[?2026h";
const ESU = "\u001b[?2026l";
const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
const CLEAR_TO_END = "\u001b[0J";

function cursorUp(lines: number): string {
	if (lines <= 0) return "";
	return `\u001b[${lines}A`;
}

/**
 * Create a live renderer that repeatedly re-renders the entire buffer and redraws in-place.
 *
 * This is intentionally "terminal plumbing" and renderer-agnostic: you inject `renderFrame()`.
 */
export function createLiveRenderer(options: LiveRendererOptions): LiveRenderer {
	let previousLines: string[] = [];
	let previousLineHeights: number[] = [];
	let cursorRow = 0;
	let cursorHidden = false;
	let overflowed = false;
	let overflowNotified = false;

	const synchronizedOutput = options.synchronizedOutput !== false;
	const hideCursor = options.hideCursor !== false;
	const width =
		typeof options.width === "number" &&
		Number.isFinite(options.width) &&
		options.width > 0
			? Math.floor(options.width)
			: 80;
	const maxRows =
		typeof options.maxRows === "number" &&
		Number.isFinite(options.maxRows) &&
		options.maxRows > 0
			? Math.floor(options.maxRows)
			: null;
	const tailRows =
		typeof options.tailRows === "number" &&
		Number.isFinite(options.tailRows) &&
		options.tailRows > 0
			? Math.floor(options.tailRows)
			: null;
	const clearOnOverflow = options.clearOnOverflow !== false;
	const clearScrollbackOnOverflow = options.clearScrollbackOnOverflow === true;
	// appendWhenPossible breaks tail mode invariants (cursorRow/overwrite region),
	// because appending grows the terminal buffer while tail mode assumes a fixed region.
	const appendWhenPossible = options.appendWhenPossible === true && !tailRows;
	let previousRenderedRaw = "";

	const extractAnsiToken = (
		input: string,
		index: number,
	): { token: string; nextIndex: number } | null => {
		if (input[index] !== "\u001b") return null;
		const next = input[index + 1];
		if (next === "[") {
			let i = index + 2;
			while (i < input.length) {
				const c = input[i] ?? "";
				if (c >= "@" && c <= "~") {
					i += 1;
					break;
				}
				i += 1;
			}
			return { token: input.slice(index, i), nextIndex: i };
		}
		if (next === "]") {
			let i = index + 2;
			while (i < input.length) {
				const c = input[i] ?? "";
				if (c === "\u0007") {
					i += 1;
					break;
				}
				if (c === "\u001b" && input[i + 1] === "\\") {
					i += 2;
					break;
				}
				i += 1;
			}
			return { token: input.slice(index, i), nextIndex: i };
		}
		if (typeof next === "string") {
			return { token: input.slice(index, index + 2), nextIndex: index + 2 };
		}
		return { token: input[index], nextIndex: index + 1 };
	};

	const updateSgrState = (current: string, sequence: string): string => {
		if (!sequence.startsWith("\u001b[") || !sequence.endsWith("m")) {
			return current;
		}
		const body = sequence.slice(2, -1);
		if (body.length === 0) return "";
		const codes = body.split(";");
		const hasReset = codes.includes("0");
		if (hasReset) {
			const hasNonReset = codes.some((code) => code !== "0");
			return hasNonReset ? sequence : "";
		}
		return current + sequence;
	};

	const splitLineToRows = (
		line: string,
		activeSgr: string,
	): { rows: string[]; activeSgr: string } => {
		if (width <= 0) return { rows: [activeSgr + line], activeSgr };
		let current = activeSgr;
		let currentWidth = 0;
		const rows: string[] = [];
		let i = 0;
		while (i < line.length) {
			const ansi = extractAnsiToken(line, i);
			if (ansi) {
				current += ansi.token;
				activeSgr = updateSgrState(activeSgr, ansi.token);
				i = ansi.nextIndex;
				continue;
			}

			const codePoint = line.codePointAt(i);
			const ch = typeof codePoint === "number" ? String.fromCodePoint(codePoint) : "";
			const w = stringWidth(ch);
			if (currentWidth + w > width && currentWidth > 0) {
				rows.push(current);
				current = activeSgr;
				currentWidth = 0;
			}
			current += ch;
			currentWidth += w;
			i += ch.length;
		}
		rows.push(current);
		return { rows, activeSgr };
	};

	const splitToRows = (text: string): string[] => {
		const lines = text.split("\n");
		if (lines.length > 0 && lines.at(-1) === "") lines.pop();
		let activeSgr = "";
		const rows: string[] = [];
		for (const line of lines) {
			const result = splitLineToRows(line, activeSgr);
			rows.push(...result.rows);
			activeSgr = result.activeSgr;
		}
		if (rows.length === 0) rows.push("");
		return rows;
	};

	const visibleWidth = (line: string): number => {
		let widthTotal = 0;
		let i = 0;
		while (i < line.length) {
			const ansi = extractAnsiToken(line, i);
			if (ansi) {
				i = ansi.nextIndex;
				continue;
			}
			const codePoint = line.codePointAt(i);
			const ch = typeof codePoint === "number" ? String.fromCodePoint(codePoint) : "";
			widthTotal += stringWidth(ch);
			i += ch.length;
		}
		return widthTotal;
	};

	const lineRowCount = (line: string): number => {
		if (width <= 0) return 1;
		const w = visibleWidth(line);
		return Math.max(1, Math.ceil(Math.max(0, w) / width));
	};

	const measureLines = (lines: string[]): number[] => lines.map(lineRowCount);

	const sumRows = (heights: number[], endExclusive?: number): number => {
		const end = typeof endExclusive === "number" ? endExclusive : heights.length;
		let total = 0;
		for (let i = 0; i < end; i += 1) total += heights[i] ?? 0;
		return total;
	};

	const render = (input: string) => {
		if (overflowed && !tailRows) return;
		const renderedRaw = options.renderFrame(input);
		const rendered = renderedRaw.endsWith("\n")
			? renderedRaw
			: `${renderedRaw}\n`;
		const rawLines = rendered.split("\n");
		if (rawLines.length > 0 && rawLines.at(-1) === "") rawLines.pop();
		if (rawLines.length === 0) rawLines.push("");
		const rawHeights = measureLines(rawLines);
		const totalRows = sumRows(rawHeights);
		const renderLines = tailRows ? splitToRows(rendered) : rawLines;
		const nextLines =
			tailRows && renderLines.length > tailRows
				? renderLines.slice(-tailRows)
				: renderLines;
		const nextHeights = tailRows ? nextLines.map(() => 1) : rawHeights;
		const nextRows = tailRows ? nextLines.length : totalRows;
		let clearMode: "scrollback" | "screen" | null = null;
		let forceFullRender = previousLines.length === 0;

		if (
			appendWhenPossible &&
			previousRenderedRaw &&
			rendered.startsWith(previousRenderedRaw)
		) {
			const appended = rendered.slice(previousRenderedRaw.length);
			if (appended.length > 0) {
				const normalized = appended.replace(/\r?\n/g, "\r\n");
				let frame = "";
				if (hideCursor && !cursorHidden) {
					frame += HIDE_CURSOR;
					cursorHidden = true;
				}
				if (synchronizedOutput) frame += BSU;
				frame += normalized;
				if (synchronizedOutput) frame += ESU;
				options.write(frame);
			}
			previousRenderedRaw = rendered;
			if (tailRows) {
				previousLines = nextLines;
				previousLineHeights = nextHeights;
				cursorRow = nextRows;
			} else {
				previousLines = rawLines;
				previousLineHeights = rawHeights;
				cursorRow = totalRows;
			}
			return;
		}

		// In tail mode we only ever draw `nextRows` (tailRows-limited), so overflow should be
		// based on the visible/drawn rows, not the full rendered height.
		const overflowRows = tailRows ? nextRows : totalRows;
		if (maxRows && overflowRows > maxRows && !overflowed) {
			overflowed = true;
			if (!overflowNotified) {
				overflowNotified = true;
				options.onOverflow?.({ rows: overflowRows, maxRows });
			}
			if (clearScrollbackOnOverflow) {
				clearMode = "scrollback";
			} else if (clearOnOverflow) {
				clearMode = "screen";
			}
			if (!tailRows) {
				let frame = "";
				if (hideCursor && !cursorHidden) {
					frame += HIDE_CURSOR;
					cursorHidden = true;
				}
				if (synchronizedOutput) frame += BSU;
				if (clearMode === "scrollback") {
					frame += "\u001b[3J\u001b[2J\u001b[H";
				} else if (clearMode === "screen") {
					frame += cursorRow > 0 ? `${cursorUp(cursorRow)}\r` : "\r";
					frame += CLEAR_TO_END;
				}
				if (synchronizedOutput) frame += ESU;
				if (frame) {
					options.write(frame);
				}
				previousLines = [];
				previousLineHeights = [];
				cursorRow = 0;
				return;
			}
			if (clearMode) {
				forceFullRender = true;
			}
		}

		if (!forceFullRender) {
			let firstChanged = -1;
			const maxLines = Math.max(previousLines.length, nextLines.length);
			for (let i = 0; i < maxLines; i += 1) {
				const oldLine = i < previousLines.length ? previousLines[i] : "";
				const newLine = i < nextLines.length ? nextLines[i] : "";
				if (oldLine !== newLine) {
					firstChanged = i;
					break;
				}
			}

			if (firstChanged === -1) return;

			if (maxRows) {
				const firstChangedRow = sumRows(previousLineHeights, firstChanged);
				const viewportTop = Math.max(0, cursorRow - maxRows);
				if (firstChangedRow < viewportTop) {
					forceFullRender = true;
				}
			}

			if (!forceFullRender) {
				let frame = "";
				if (hideCursor && !cursorHidden) {
					frame += HIDE_CURSOR;
					cursorHidden = true;
				}

				if (synchronizedOutput) frame += BSU;
				const firstChangedRow = sumRows(previousLineHeights, firstChanged);
				const rowDiff = firstChangedRow - cursorRow;
				if (rowDiff > 0) {
					frame += `\u001b[${rowDiff}B`;
				} else if (rowDiff < 0) {
					frame += cursorUp(-rowDiff);
				}
				frame += "\r";
				frame += CLEAR_TO_END;
				for (let i = firstChanged; i < nextLines.length; i += 1) {
					frame += "\r";
					frame += nextLines[i];
					frame += "\r\n";
				}

				if (synchronizedOutput) frame += ESU;
				options.write(frame);

				cursorRow = nextRows;
				previousLines = nextLines;
				previousLineHeights = nextHeights;
				previousRenderedRaw = rendered;
				return;
			}
		}

		let frame = "";
		if (hideCursor && !cursorHidden) {
			frame += HIDE_CURSOR;
			cursorHidden = true;
		}
		if (synchronizedOutput) frame += BSU;
		if (clearMode === "scrollback") {
			frame += "\u001b[3J\u001b[2J\u001b[H";
		} else {
			frame += cursorRow > 0 ? `${cursorUp(cursorRow)}\r` : "\r";
			frame += CLEAR_TO_END;
		}
		for (let i = 0; i < nextLines.length; i += 1) {
			frame += "\r";
			frame += nextLines[i];
			frame += "\r\n";
		}
		if (synchronizedOutput) frame += ESU;
		options.write(frame);
		cursorRow = nextRows;
		previousLines = nextLines;
		previousLineHeights = nextHeights;
		previousRenderedRaw = rendered;
	};

	const finish = (final?: string) => {
		if (typeof final === "string") {
			// Render the full frame (ignore tailRows) before restoring cursor visibility.
			const renderedRaw = options.renderFrame(final);
			const rendered = renderedRaw.endsWith("\n")
				? renderedRaw
				: `${renderedRaw}\n`;
			const rawLines = rendered.split("\n");
			if (rawLines.length > 0 && rawLines.at(-1) === "") rawLines.pop();
			if (rawLines.length === 0) rawLines.push("");
			const rawHeights = measureLines(rawLines);
			const totalRows = sumRows(rawHeights);
			const nextLines = rawLines;
			const nextHeights = rawHeights;
			const nextRows = totalRows;
			let frame = "";
			if (hideCursor && !cursorHidden) {
				frame += HIDE_CURSOR;
				cursorHidden = true;
			}
			if (synchronizedOutput) frame += BSU;
			frame += cursorRow > 0 ? `${cursorUp(cursorRow)}\r` : "\r";
			frame += CLEAR_TO_END;
			for (let i = 0; i < nextLines.length; i += 1) {
				frame += "\r";
				frame += nextLines[i];
				frame += "\r\n";
			}
			if (synchronizedOutput) frame += ESU;
			options.write(frame);
			cursorRow = nextRows;
			previousLines = nextLines;
			previousLineHeights = nextHeights;
			previousRenderedRaw = rendered;
		}
		if (hideCursor && cursorHidden) {
			options.write(SHOW_CURSOR);
			cursorHidden = false;
		}
	};

	return { render, finish };
}
