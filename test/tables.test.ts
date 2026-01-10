import { describe, expect, it } from "vitest";
import { strip } from "../src/index.ts";

const noColor = { color: false, hyperlinks: false, wrap: true, width: 40 };

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

	it("wraps cells without shifting columns into separate rows", () => {
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
		const bodyLines = out
			.split("\n")
			.map((l) => l.trimEnd())
			.filter((l) => l.includes("│"))
			.filter((l) => l.includes("g"));
		expect(bodyLines.length).toBeGreaterThan(0);
		for (const line of bodyLines) {
			expect(line).toContain("a");
		}
	});

	it("does not truncate header cells when content fits", () => {
		const md = `
| Provider | Enabled | Configured | Detail |
| --- | --- | --- | --- |
| WhatsApp | ON | WARN | not linked |
`;
		const out = strip(md, { ...noColor, width: 120, wrap: true });
		expect(out).toContain("Provider");
		expect(out).not.toContain("Provi…");
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
		expect(line?.includes(" c ")).toBe(true);
	});
});
