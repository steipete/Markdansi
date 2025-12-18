import stringWidth from "string-width";
import stripAnsi from "strip-ansi";

export type LiveRenderer = {
	render: (input: string) => void;
	finish: () => void;
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
	let previousRows = 0;
	let cursorHidden = false;

	const synchronizedOutput = options.synchronizedOutput !== false;
	const hideCursor = options.hideCursor !== false;
	const width =
		typeof options.width === "number" &&
		Number.isFinite(options.width) &&
		options.width > 0
			? Math.floor(options.width)
			: 80;

	const countRows = (text: string): number => {
		const lines = text.split("\n");
		if (lines.length > 0 && lines.at(-1) === "") lines.pop();
		let rows = 0;
		for (const line of lines) {
			const visible = stripAnsi(line);
			const w = stringWidth(visible);
			rows += Math.max(1, Math.ceil(Math.max(0, w) / width));
		}
		return rows;
	};

	const render = (input: string) => {
		const renderedRaw = options.renderFrame(input);
		const rendered = renderedRaw.endsWith("\n")
			? renderedRaw
			: `${renderedRaw}\n`;
		const lines = rendered.split("\n");
		if (lines.length > 0 && lines.at(-1) === "") lines.pop();
		const newRows = countRows(rendered);

		let frame = "";
		if (hideCursor && !cursorHidden) {
			frame += HIDE_CURSOR;
			cursorHidden = true;
		}

		if (synchronizedOutput) frame += BSU;
		frame += previousRows > 0 ? `${cursorUp(previousRows)}\r` : "\r";
		frame += CLEAR_TO_END;
		for (const line of lines) {
			frame += "\r";
			frame += line;
			frame += "\r\n";
		}

		if (synchronizedOutput) frame += ESU;
		options.write(frame);

		previousRows = newRows;
	};

	const finish = () => {
		if (hideCursor && cursorHidden) {
			options.write(SHOW_CURSOR);
			cursorHidden = false;
		}
	};

	return { render, finish };
}
