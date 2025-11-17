import stripAnsi from "strip-ansi";
import supportsHyperlinks from "supports-hyperlinks";
import { describe, expect, it, vi } from "vitest";
import { handleStdoutEpipe, parseArgs } from "../src/cli.ts";
import { hyperlinkSupported } from "../src/hyperlink.ts";
import { render, strip } from "../src/index.ts";
import { createStyler, themes } from "../src/theme.ts";
import { wrapText } from "../src/wrap.ts";

const noColor = { color: false, hyperlinks: false, wrap: true, width: 40 };

describe("inline formatting", () => {
	it("renders emphasis/strong/code/strike", () => {
		const out = strip("Hello _em_ **strong** `code` ~~gone~~", noColor);
		expect(out).toContain("Hello em strong code gone");
	});

	it("uses blockCode / inlineCode themes distinctly", () => {
		const ansi = render("`inline`\n\n```\nblock\n```", {
			color: true,
			theme: {
				...themes.default,
				inlineCode: { color: "red" },
				blockCode: { color: "green" },
			},
			wrap: false,
		});
		expect(ansi).toContain("\u001b[31minline"); // red
		expect(ansi).toContain("\u001b[32mblock"); // green
	});

	it("applies highlighter hook to code blocks", () => {
		const out = render("```\ncode\n```", {
			color: true,
			wrap: false,
			highlighter: (code) => code.toUpperCase(),
		});
		expect(out).toContain("CODE");
	});

	it("handles line breaks in inline content", () => {
		const out = strip("Hello\\nworld", { ...noColor, wrap: true, width: 80 });
		expect(out.split("\n").length).toBeGreaterThan(1);
	});

	it("keeps hard breaks (two-space newline)", () => {
		const out = strip("line one  \nline two", {
			...noColor,
			wrap: true,
			width: 80,
		});
		expect(out.split("\n").length).toBeGreaterThan(1);
	});

	it("ignores inline HTML content safely", () => {
		const out = strip("<div>ignored</div>", { ...noColor });
		expect(out).toBe("");
	});

	it("renders headings and horizontal rules", () => {
		const md = "# Title\n\n---\n";
		const out = strip(md, { ...noColor, wrap: true, width: 80 });
		expect(out).toContain("Title");
		expect(out).toContain("—");
	});
});

describe("wrapping", () => {
	it("wraps paragraphs at width", () => {
		const out = strip("one two three four five six seven eight nine ten", {
			...noColor,
			width: 10,
		});
		const lines = out.split("\n");
		expect(lines[0].length).toBeLessThanOrEqual(10);
	});

	it("respects no-wrap", () => {
		const out = strip("one two three four five six seven eight nine ten", {
			...noColor,
			wrap: false,
			width: 5,
		});
		expect(out.split("\n")[0].length).toBeGreaterThan(20);
	});

	it("allows long url to overflow without breaking word", () => {
		const url = "https://example.com/averylongpathwithoutspaces";
		const out = strip(url, { ...noColor, width: 10, wrap: true });
		expect(out).toContain(url);
	});

	it("wrapText returns empty line when input is empty", () => {
		expect(wrapText("", 5, true)).toEqual([""]);
	});

	it("wrapText returns original when width <= 0", () => {
		expect(wrapText("abc", 0, true)).toEqual(["abc"]);
	});
});

describe("lists and tasks", () => {
	it("renders task list items", () => {
		const out = strip("- [ ] open\n- [x] done", noColor);
		expect(out).toContain("[ ] open");
		expect(out).toContain("[x] done");
	});

	it("splits loose lists with blank line", () => {
		const out = strip("- item 1\n\n- item 2", noColor);
		expect(out.split("\n").filter((l) => l === "").length).toBeGreaterThan(0);
	});
});

describe("tables", () => {
	it("does not linkify underscores inside tables", () => {
		const md = `
| Filename | Size |
| --- | --- |
| icon_16x16.png | 16 |
| icon_16x16@2x.png | 32 |
`;
		const out = strip(md, { ...noColor, wrap: true, tableTruncate: false });
		const lines = out.split("\n").filter((l) => l.includes("icon_16x16"));
		lines.forEach((line) => {
			expect(line).not.toMatch(/https?:/);
			expect(line).toContain("icon_16x16");
		});
	});

	it("respects inline links in table cells but keeps other cells plain", () => {
		const md = `
| File | Link |
| --- | --- |
| icon_16x16.png | https://example.com/icon.png |
`;
		const out = strip(md, {
			...noColor,
			wrap: true,
			hyperlinks: false,
			tableTruncate: false,
			width: 60,
		});
		expect(out).toContain("icon_16x16.png");
		expect(out).toContain("https://example.com/icon.png");
	});

	it("keeps mailto-style autolinks plain inside tables", () => {
		const md = `
| File | Size |
| --- | --- |
| icon_16x16@2x.png | 32 |
`;
		const out = strip(md, {
			...noColor,
			wrap: true,
			hyperlinks: true,
			tableTruncate: false,
			width: 40,
		});
		// Should render as plain text, not OSC-8 or styled link
		expect(out).toContain("icon_16x16@2x.png");
		expect(out).not.toContain("\u001B]8;;"); // no OSC hyperlink
	});
	it("renders ascii and no-border tables with padding/dense options", () => {
		const md = `
| h1 | h2 |
| --- | --- |
| a | b |
`;
		const ascii = strip(md, {
			...noColor,
			tableBorder: "ascii",
			tablePadding: 2,
		});
		expect(ascii).toContain("+");
		expect(ascii).toContain("h1");
		expect(ascii).toContain("a");

		const none = strip(md, {
			...noColor,
			tableBorder: "none",
			tableDense: true,
			tablePadding: 0,
		});
		expect(none).toContain("h1");
		expect(none).toContain("b");
	});

	it("renders gfm tables", () => {
		const md = `
| h1 | h2 |
| --- | --- |
| a | b |
`;
		const out = strip(md, { ...noColor, width: 30 });
		expect(out).toMatch(/h1/);
		expect(out).toMatch(/h2/);
	});

	it("wraps table cells on spaces when width is small", () => {
		const md = `
| h1 | h2 |
| --- | --- |
| a b c d e f | g |
`;
		const out = strip(md, {
			...noColor,
			width: 15,
			wrap: true,
			tableTruncate: false,
		});
		const lines = out
			.trim()
			.split("\n")
			.filter((l) => l.includes("│") || l.includes("|"));
		// Expect at least header + body + borders; wrapped content should add extra line
		expect(lines.length).toBeGreaterThan(3);
	});

	it("allows long words in cells to overflow (no hard break)", () => {
		const word = "Supercalifragilistic";
		const md = `
| h1 | h2 |
| --- | --- |
| ${word} | x |
`;
		const out = strip(md, {
			...noColor,
			width: 10,
			wrap: true,
			tableTruncate: false,
		});
		expect(out).toContain(word);
	});

	it("respects table alignment markers from GFM", () => {
		const md = `
| h1 | h2 |
| :-- | --: |
| left | right |
`;
		const out = strip(md, {
			...noColor,
			width: 30,
			wrap: true,
			tableTruncate: false,
		});
		const lines = out
			.trim()
			.split("\n")
			.filter((l) => l.includes("│") || l.includes("|"));
		expect(lines.some((l) => /left/.test(l) && /right/.test(l))).toBe(true);
	});

	it("truncates cells by default when width is tight", () => {
		const md = `
| col | col2 |
| --- | --- |
| Supercalifragilistic | short |
`;
		const out = strip(md, { ...noColor, width: 18, wrap: true });
		expect(out).toContain("…");
	});

	it("keeps at least ellipsis when width extremely small", () => {
		const md = `
| h |
| - |
| verylong |
`;
		const out = strip(md, {
			...noColor,
			width: 4,
			wrap: true,
			tablePadding: 0,
		});
		expect(out).toMatch(/…/);
	});

	it("aligns left/center/right cells", () => {
		const md = `
| l | c | r |
| :-- | :-: | --: |
| a | b | c |
`;
		const out = strip(md, { ...noColor, width: 40, wrap: true });
		const line = out
			.split("\n")
			.find((l) => l.includes("a") && l.includes("c"));
		expect(line).toBeDefined();
		expect(line.includes(" c ")).toBe(true);
	});
});

describe("hyperlinks", () => {
	it("adds url suffix when hyperlinks are off", () => {
		const out = strip("[link](https://example.com)", { ...noColor });
		expect(out).toContain("link (https://example.com)");
	});

	it("emits OSC-8 hyperlinks when enabled", () => {
		const out = render("[x](https://example.com)", {
			color: true,
			hyperlinks: true,
			wrap: false,
		});
		expect(out).toContain(
			"\u001B]8;;https://example.com\u0007x\u001B]8;;\u0007",
		);
	});

	it("disables OSC when color is false even if hyperlinks true", () => {
		const out = render("[x](https://example.com)", {
			color: false,
			hyperlinks: true,
			wrap: false,
		});
		expect(out).not.toContain("\u001B]8;;");
		expect(out).toContain("x (https://example.com)");
	});

	it("returns false when supports-hyperlinks stdout is missing", () => {
		const original = supportsHyperlinks.stdout;
		// eslint-disable-next-line no-param-reassign
		supportsHyperlinks.stdout = undefined;
		try {
			expect(hyperlinkSupported()).toBe(false);
			// also cover the true-path call
			supportsHyperlinks.stdout = () => true;
			expect(hyperlinkSupported()).toBe(true);
		} finally {
			// eslint-disable-next-line no-param-reassign
			supportsHyperlinks.stdout = original;
		}
	});
});

describe("blockquotes", () => {
	it("prefixes lines with quote leader", () => {
		const out = strip("> quoted line", noColor);
		expect(out.trim().startsWith("│ ")).toBe(true);
	});
});

describe("code blocks", () => {
	it("wraps code lines when codeWrap is enabled (default)", () => {
		const md = "```\n0123456789ABCDEFG\n```";
		const out = strip(md, { ...noColor, width: 12, codeBox: false });
		const firstLine = out.split("\n")[0];
		expect(firstLine.length).toBeLessThanOrEqual(12);
		expect(out).toContain("0123456789");
	});

	it("allows overflow when codeWrap is false", () => {
		const md = "```\n0123456789ABCDEFG\n```";
		const out = strip(md, {
			...noColor,
			width: 10,
			codeWrap: false,
			codeBox: false,
		});
		const firstLine = out.split("\n")[0];
		expect(firstLine.length).toBeGreaterThan(15);
	});

	it("respects codeBox=false with gutter", () => {
		const md = "```\nline1\nline2\n```";
		const out = render(md, {
			color: true,
			codeBox: false,
			codeGutter: true,
			wrap: false,
		});
		const plain = stripAnsi(out);
		expect(plain).toMatch(/^1\s+line1/m);
		expect(plain).toMatch(/^2\s+line2/m);
	});

	it("formats gutter width for multi-digit lines", () => {
		const md = `\`\`\`
${Array.from({ length: 12 }, (_, i) => `l${i + 1}`).join("\n")}
\`\`\``;
		const out = render(md, { color: true, codeGutter: true, wrap: false });
		expect(stripAnsi(out)).toContain("12 ");
	});

	it("renders language label in code box header", () => {
		const md = "```bash\nthis line is definitely longer than the label\n```";
		const out = render(md, { color: true, wrap: false });
		const firstLineRaw = out.split("\n")[0];
		const bodyLine = out.split("\n")[1];
		const bottomLine = out.split("\n")[out.split("\n").length - 3];
		const firstLine = stripAnsi(firstLineRaw);
		expect(firstLine.startsWith("┌")).toBe(true);
		expect(firstLine).toContain("[bash]");
		expect(firstLine).toMatch(/┌ \[bash]─+┐/);
		// Header width should match body/bottom widths
		expect(firstLine.length).toBe(stripAnsi(bodyLine).length);
		expect(firstLine.length).toBe(stripAnsi(bottomLine).length);
		// Borders should be dimmed (SGR 2)
		expect(firstLineRaw).toContain("\u001B[2m");
		expect(bottomLine).toContain("\u001B[2m");
	});

	it("omits label when language is absent", () => {
		const md = "```\nfoo\n```";
		const out = render(md, { color: false, wrap: false });
		const firstLine = out.split("\n")[0];
		expect(firstLine.startsWith("┌")).toBe(true);
		expect(firstLine).not.toContain("[");
	});

	it("keeps header width when label is long", () => {
		const md = "```superlonglanguageid\nfoo\n```";
		const out = render(md, { color: false, wrap: false });
		const lines = out.split("\n");
		const top = lines[0];
		const body = lines[1];
		// Header should be wider or equal to body content
		expect(top.length).toBeGreaterThanOrEqual(
			body.length - 2 /* box padding */,
		);
		expect(top).toContain("[superlonglanguageid]");
	});

	it("does not emit blank line before boxed code", () => {
		const md = "```bash\nfoo\n```";
		const out = render(md, { color: false, wrap: false });
		expect(out.startsWith("┌")).toBe(true);
	});

	it("keeps reference-style continuations out of code boxes", () => {
		const md = `[1]: https://example.com/icon "\n\t Icon Composer Notes \n\t\n"`;
		const out = render(md, { color: false, wrap: true });
		expect(out).not.toContain("┌"); // no boxed code
		expect(out).toContain(`[1]: https://example.com/icon "`);
		expect(out).toContain("Icon Composer Notes");
	});

	it("separates definitions with a blank line footer-style", () => {
		const md = `Body line.\n[1]: https://example.com "Title"\nNext.`;
		const out = render(md, { color: false, wrap: true });
		const lines = out.split("\n");
		expect(lines[0]).toBe("Body line.");
		expect(lines[1]).toBe(""); // blank line before definition
		expect(lines[2]).toBe('[1]: https://example.com "Title"');
		expect(lines[3]).toBe("Next.");
		expect(lines[4]).toBe(""); // final newline
	});
});

describe("cli stdout EPIPE handling", () => {
	it("exits cleanly on EPIPE", () => {
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockReturnValue(undefined as never);
		handleStdoutEpipe();
		const error = Object.assign(new Error("epipe"), { code: "EPIPE" });
		const listener = process.stdout.listeners("error").at(-1) as
			| ((err: NodeJS.ErrnoException) => void)
			| undefined;
		expect(listener).toBeDefined();
		listener?.(error as NodeJS.ErrnoException);
		expect(exitSpy).toHaveBeenCalledWith(0);
		exitSpy.mockRestore();
	});
});

describe("styling helpers", () => {
	it("applies bold/underline/bg/strike when color enabled", () => {
		const style = createStyler({ color: true });
		const styled = style("x", {
			color: "red",
			bgColor: "bgBlue",
			bold: true,
			underline: true,
			dim: true,
			strike: true,
		});
		expect(styled).toContain("\u001b[31m"); // red
		expect(styled).toContain("\u001b[44m"); // bgBlue
		expect(styled).toContain("\u001b[1m"); // bold
		expect(styled).toContain("\u001b[9m"); // strike
	});

	it("uses default theme colors (cyan inline, green block, yellow header)", () => {
		const ansi = render("`inline`\n\n```\nblock\n```\n\n# H", {
			color: true,
			wrap: false,
			codeBox: false,
		});
		expect(ansi).toContain("\u001b[36m"); // cyan inline code
		expect(ansi).toContain("\u001b[32m"); // green block code
	});

	it("falls back to theme.code when inline/block absent", () => {
		const ansi = render("`x`\n\n```\ny\n```", {
			color: true,
			wrap: false,
			theme: { code: { color: "red" } },
		});
		expect(ansi).toContain("\u001b[31m");
	});

	it("returns plain text when color is disabled", () => {
		const style = createStyler({ color: false });
		expect(style("plain", { color: "red" })).toBe("plain");
	});
});

describe("cli parse args", () => {
	it("maps new flags to options", () => {
		const args = parseArgs([
			"node",
			"cli",
			"--table-border=ascii",
			"--table-dense",
			"--table-truncate=false",
			"--table-padding",
			"3",
			"--code-wrap=false",
			"--code-box=false",
			"--code-gutter=true",
		]);
		expect(args).toMatchObject({
			tableBorder: "ascii",
			tableDense: true,
			tableTruncate: false,
			tablePadding: 3,
			codeWrap: false,
			codeBox: false,
			codeGutter: true,
		});
	});
});
