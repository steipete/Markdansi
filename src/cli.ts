#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./index.js";
import type { RenderOptions, ThemeName } from "./types.js";

type CliArgs = Partial<RenderOptions> & {
	in?: string;
	out?: string;
	help?: boolean;
};

/**
 * Ignore EPIPE when downstream (e.g., `head`) closes early.
 */
export function handleStdoutEpipe(): void {
	process.stdout.on("error", (err: NodeJS.ErrnoException) => {
		if (err && err.code === "EPIPE") {
			process.exit(0);
			return;
		}
		// For other stdout errors, fail fast but don't throw unhandled.
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}

/**
 * Parse CLI arguments into RenderOptions-ish object (plus in/out paths).
 */
export function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {};
	for (let i = 2; i < argv.length; i += 1) {
		const a = argv[i];
		if (!a) continue;
		if (a === "--no-wrap") args.wrap = false;
		else if (a === "--no-color") args.color = false;
		else if (a === "--no-links") args.hyperlinks = false;
		else if (a === "--code-wrap=false") args.codeWrap = false;
		else if (a === "--code-wrap=true") args.codeWrap = true;
		else if (a === "--code-box=false") args.codeBox = false;
		else if (a === "--code-box=true") args.codeBox = true;
		else if (a === "--code-gutter=true") args.codeGutter = true;
		else if (a === "--code-gutter=false") args.codeGutter = false;
		else if (a.startsWith("--table-border=")) {
			const val = a.split("=")[1];
			if (val === "unicode" || val === "ascii" || val === "none")
				args.tableBorder = val;
		} else if (a === "--table-dense") args.tableDense = true;
		else if (a === "--table-truncate=false") args.tableTruncate = false;
		else if (a === "--table-truncate=true") args.tableTruncate = true;
		else if (a === "--table-padding") {
			const next = argv[i + 1];
			if (next) args.tablePadding = Number(next);
			i += 1;
		} else if (a === "--table-ellipsis") {
			const next = argv[i + 1];
			if (next) args.tableEllipsis = next;
			i += 1;
		} else if (a === "--in") {
			const next = argv[i + 1];
			if (next) args.in = next;
			i += 1;
		} else if (a === "--out") {
			const next = argv[i + 1];
			if (next) args.out = next;
			i += 1;
		} else if (a === "--width") {
			const next = argv[i + 1];
			if (next) args.width = Number(next);
			i += 1;
		} else if (a.startsWith("--theme=")) {
			const themeVal = a.split("=")[1];
			if (themeVal) args.theme = themeVal as ThemeName;
		} else if (a === "--list-indent") {
			const next = argv[i + 1];
			if (next) args.listIndent = Number(next);
			i += 1;
		} else if (a === "--quote-prefix") {
			const next = argv[i + 1];
			if (next) args.quotePrefix = next;
			i += 1;
		} else if (a === "--help" || a === "-h") args.help = true;
	}
	return args;
}

/**
 * CLI entrypoint.
 */
function main(): void {
	handleStdoutEpipe();
	const args = parseArgs(process.argv);
	if (args.help) {
		process.stdout.write(`markdansi options:
  --in FILE           Input file (default: stdin)
  --out FILE          Output file (default: stdout)
  --width N           Wrap width (default: TTY cols or 80)
  --no-wrap           Disable hard wrapping
  --no-color          Disable ANSI/OSC output
  --no-links          Disable OSC-8 hyperlinks
  --theme NAME        Theme (default|dim|bright)
  --list-indent N     Spaces per list nesting level (default: 2)
  --quote-prefix STR  Prefix for blockquotes (default: "│ ")
  --table-border STR  unicode|ascii|none
  --table-padding N   Spaces around table cell content
  --table-dense       Fewer separator rows
  --table-truncate    Default true; pass --table-truncate=false to disable
  --table-ellipsis STR  Ellipsis text for truncation
  --code-wrap[=true|false]   Wrap code lines (default true)
  --code-box[=true|false]    Box code blocks (default true)
  --code-gutter[=true|false] Show code line numbers (default false)
`);
		process.exit(0);
	}
	const input =
		args.in && args.in !== "-"
			? fs.readFileSync(path.resolve(args.in), "utf8")
			: fs.readFileSync(0, "utf8");

	const renderOptions: RenderOptions = {
		...(args.wrap !== undefined ? { wrap: args.wrap } : {}),
		...(args.width !== undefined ? { width: args.width } : {}),
		...(args.color !== undefined ? { color: args.color } : {}),
		...(args.hyperlinks !== undefined ? { hyperlinks: args.hyperlinks } : {}),
		...(args.theme !== undefined ? { theme: args.theme } : {}),
		...(args.listIndent !== undefined ? { listIndent: args.listIndent } : {}),
		...(args.quotePrefix !== undefined
			? { quotePrefix: args.quotePrefix }
			: {}),
	};

	const output = render(input, renderOptions);

	if (args.out) {
		fs.writeFileSync(path.resolve(args.out), output, "utf8");
	} else {
		process.stdout.write(output);
	}
}

export function isDirectCliInvocation(
	metaUrl: string,
	argv1?: string,
): boolean {
	if (!argv1) return false;
	try {
		const entry = fs.realpathSync(argv1);
		const self = fs.realpathSync(fileURLToPath(metaUrl));
		return entry === self;
	} catch {
		return false;
	}
}

// Only run the CLI when executed directly, not when imported for tests.
if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
	main();
}
