import { describe, expect, it } from "vitest";

import { createMarkdownStreamer, render } from "../src/index.js";

const renderNoColor = (markdown: string) =>
	render(markdown, { width: 60, wrap: true, color: false, hyperlinks: false });

describe("markdown streamer (hybrid)", () => {
	it("buffers until newline for regular lines", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("Hello")).toBe("");
		expect(s.push(" world\n")).toBe("Hello world\n");
	});

	it("buffers fenced code blocks until the closing fence", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("```txt\n")).toBe("");
		expect(s.push("line 1\n")).toBe("");
		expect(s.push("```\n")).not.toBe("");
	});

	it("buffers tables until a non-table line", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("| A | B |\n")).toBe("");
		expect(s.push("|---|---|\n")).toBe("");
		expect(s.push("| 1 | 2 |\n")).toBe("");
		const out = s.push("\n");
		expect(out).toContain("A");
		expect(out).toContain("B");
	});

	it("trims markdansi heading leading newline for fragment streaming", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		const out = s.push("## Heading\n");
		expect(out.startsWith("\n")).toBe(false);
		expect(out).toContain("Heading\n");
	});

	it("collapses consecutive blank lines in single spacing mode", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "single",
		});
		const out = s.push("A\n\n\nB\n") + s.finish();
		expect(out).toContain("A\n\nB\n");
		expect(out).not.toContain("A\n\n\nB\n");
	});
});
