#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "./index.js";
import { themeNames } from "./types.js";
import type { RenderOptions, ThemeName } from "./types.js";

type CliArgs = Partial<RenderOptions> & {
  in?: string;
  out?: string;
  help?: boolean;
};

function readOptionValue(
  argv: string[],
  index: number,
  option: string,
  allowLeadingDashes = false,
): string {
  const value = argv[index + 1];
  if (value === undefined || (!allowLeadingDashes && value.startsWith("--"))) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseIntegerOption(option: string, value: string, minimum: number): number {
  const parsed = Number(value);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed) || parsed < minimum) {
    const range = minimum === 0 ? "a non-negative integer" : "a positive integer";
    throw new Error(`${option} must be ${range}`);
  }
  return parsed;
}

function parseTheme(value: string): ThemeName {
  const theme = themeNames.find((candidate) => candidate === value);
  if (theme) return theme;
  throw new Error(`--theme must be one of: ${themeNames.join(", ")}`);
}

function parseTableBorder(value: string): NonNullable<RenderOptions["tableBorder"]> {
  if (value === "unicode" || value === "ascii" || value === "none") return value;
  throw new Error("--table-border must be unicode, ascii, or none");
}

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
    else if (a === "--code-wrap") args.codeWrap = true;
    else if (a === "--code-wrap=false") args.codeWrap = false;
    else if (a === "--code-wrap=true") args.codeWrap = true;
    else if (a === "--code-box") args.codeBox = true;
    else if (a === "--code-box=false") args.codeBox = false;
    else if (a === "--code-box=true") args.codeBox = true;
    else if (a === "--code-gutter") args.codeGutter = true;
    else if (a === "--code-gutter=true") args.codeGutter = true;
    else if (a === "--code-gutter=false") args.codeGutter = false;
    else if (a.startsWith("--table-border=")) {
      args.tableBorder = parseTableBorder(a.slice("--table-border=".length));
    } else if (a === "--table-border") {
      args.tableBorder = parseTableBorder(readOptionValue(argv, i, a));
      i += 1;
    } else if (a === "--table-dense") args.tableDense = true;
    else if (a === "--table-truncate") args.tableTruncate = true;
    else if (a === "--table-truncate=false") args.tableTruncate = false;
    else if (a === "--table-truncate=true") args.tableTruncate = true;
    else if (a === "--table-padding") {
      const next = readOptionValue(argv, i, a);
      args.tablePadding = parseIntegerOption(a, next, 0);
      i += 1;
    } else if (a === "--table-ellipsis") {
      args.tableEllipsis = readOptionValue(argv, i, a, true);
      i += 1;
    } else if (a === "--in") {
      args.in = readOptionValue(argv, i, a, true);
      i += 1;
    } else if (a === "--out") {
      args.out = readOptionValue(argv, i, a, true);
      i += 1;
    } else if (a === "--width") {
      const next = readOptionValue(argv, i, a);
      args.width = parseIntegerOption(a, next, 1);
      i += 1;
    } else if (a.startsWith("--theme=")) {
      args.theme = parseTheme(a.slice("--theme=".length));
    } else if (a === "--theme") {
      args.theme = parseTheme(readOptionValue(argv, i, a));
      i += 1;
    } else if (a === "--list-indent") {
      const next = readOptionValue(argv, i, a);
      args.listIndent = parseIntegerOption(a, next, 0);
      i += 1;
    } else if (a === "--quote-prefix") {
      args.quotePrefix = readOptionValue(argv, i, a, true);
      i += 1;
    } else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("-")) throw new Error(`unknown option: ${a}`);
    else if (!args.in) args.in = a;
    else throw new Error(`unexpected positional argument: ${a}`);
  }
  return args;
}

/**
 * CLI entrypoint.
 */
function main(): void {
  handleStdoutEpipe();
  const { in: inputPath, out: outputPath, help, ...renderOptions } = parseArgs(process.argv);
  if (help) {
    process.stdout.write(`markdansi [FILE] [options]

  markdansi file.md            Render file
  markdansi --in file.md       Same (explicit)
  cat file.md | markdansi      Read from stdin

Options:
  --in FILE           Input file (default: stdin)
  --out FILE          Output file (default: stdout)
  --width N           Wrap width (default: TTY cols or 80)
  --no-wrap           Disable hard wrapping
  --no-color          Disable ANSI/OSC output
  --no-links          Disable OSC-8 hyperlinks
  --theme NAME        Theme (${themeNames.join("|")})
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
    inputPath && inputPath !== "-"
      ? fs.readFileSync(path.resolve(inputPath), "utf8")
      : fs.readFileSync(0, "utf8");

  const output = render(input, renderOptions);

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

export function isDirectCliInvocation(metaUrl: string, argv1?: string): boolean {
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
  try {
    main();
  } catch (error) {
    console.error(`markdansi: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
