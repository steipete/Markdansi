import supportsHyperlinks from "supports-hyperlinks";
import { describe, expect, it } from "vitest";
import { hyperlinkSupported } from "../src/hyperlink.js";
import { render, strip } from "../src/index.js";
import { createStyler, themes } from "../src/theme.js";
import { wrapText } from "../src/wrap.js";

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
	it("renders gfm tables", () => {
		const md = `
| h1 | h2 |
| --- | --- |
| a | b |
`;
		const out = strip(md, { ...noColor, width: 30 });
		expect(out).toContain("| h1 | h2 |");
	});

	it("wraps table cells on spaces when width is small", () => {
		const md = `
| h1 | h2 |
| --- | --- |
| a b c d e f | g |
`;
		const out = strip(md, { ...noColor, width: 15, wrap: true });
		const lines = out
			.trim()
			.split("\n")
			.filter((l) => l.startsWith("|"));
		// Expect more than header + divider + single body line => wrapping produced extra line
		expect(lines.length).toBeGreaterThan(3);
	});

	it("allows long words in cells to overflow (no hard break)", () => {
		const word = "Supercalifragilistic";
		const md = `
| h1 | h2 |
| --- | --- |
| ${word} | x |
`;
		const out = strip(md, { ...noColor, width: 10, wrap: true });
		expect(out).toContain(word);
	});

	it("respects table alignment markers from GFM", () => {
		const md = `
| h1 | h2 |
| :-- | --: |
| left | right |
`;
		const out = strip(md, { ...noColor, width: 30, wrap: true });
		const lines = out
			.trim()
			.split("\n")
			.filter((l) => l.startsWith("|"));
		expect(lines.some((l) => l.includes("left") && l.includes("right"))).toBe(
			true,
		);
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

	it("returns plain text when color is disabled", () => {
		const style = createStyler({ color: false });
		expect(style("plain", { color: "red" })).toBe("plain");
	});
});
