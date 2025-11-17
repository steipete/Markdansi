#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { render } from "./index.js";

function parseArgs(argv) {
	const args = {};
	for (let i = 2; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === "--no-wrap") args.wrap = false;
		else if (a === "--no-color") args.color = false;
		else if (a === "--no-links") args.hyperlinks = false;
		else if (a === "--in") args.in = argv[++i];
		else if (a === "--out") args.out = argv[++i];
		else if (a === "--width") args.width = Number(argv[++i]);
		else if (a.startsWith("--theme=")) args.theme = a.split("=")[1];
		else if (a === "--list-indent") args.listIndent = Number(argv[++i]);
		else if (a === "--quote-prefix") args.quotePrefix = argv[++i];
		else if (a === "--help" || a === "-h") args.help = true;
	}
	return args;
}

function main() {
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
`);
		process.exit(0);
	}
	const input =
		args.in && args.in !== "-"
			? fs.readFileSync(path.resolve(args.in), "utf8")
			: fs.readFileSync(0, "utf8");

	const output = render(input, {
		wrap: args.wrap,
		width: args.width,
		color: args.color,
		hyperlinks: args.hyperlinks,
		theme: args.theme,
		listIndent: args.listIndent,
		quotePrefix: args.quotePrefix,
	});

	if (args.out) {
		fs.writeFileSync(path.resolve(args.out), output, "utf8");
	} else {
		process.stdout.write(output);
	}
}

main();
