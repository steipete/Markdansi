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

	it("does not introduce extra blank lines around headings", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "single",
		});
		const out =
			s.push("## Overview\n\n- One\n\n## Key Evidence\n- Two\n") + s.finish();
		expect(out).not.toContain("\n\n\n");
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

	it("drops leading blank lines before first content", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "single",
		});
		const out = s.push("\n\nA\n") + s.finish();
		expect(out.startsWith("\n")).toBe(false);
		expect(out).toContain("A\n");
	});

	it("preserves consecutive blank lines in preserve mode", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		const out = s.push("A\n\n\nB\n") + s.finish();
		expect(out).toContain("A\n\n\nB\n");
	});

	it("flushes a held table header when the next line is not a separator", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("| A |\n")).toBe("");
		const out = s.push("Not a table\n");
		const idxHeader = out.indexOf("A");
		const idxLine = out.indexOf("Not a table");
		expect(idxHeader).toBeGreaterThanOrEqual(0);
		expect(idxLine).toBeGreaterThan(idxHeader);
	});

	it("flushes tables on a non-row line and continues rendering", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("| A | B |\n")).toBe("");
		expect(s.push("|---|---|\n")).toBe("");
		expect(s.push("| 1 | 2 |\n")).toBe("");
		const out = s.push("Next\n");
		expect(out).toContain("A");
		expect(out).toContain("Next");
	});

	it("flushes unterminated fenced code blocks on finish", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("```txt\n")).toBe("");
		expect(s.push("code\n")).toBe("");
		const out = s.finish();
		expect(out).toContain("code");
	});

	it("flushes a final buffered line on finish", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("Hello")).toBe("");
		const out = s.finish();
		expect(out).toContain("Hello\n");
	});

	it("reset clears buffered state", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		expect(s.push("| A | B |\n")).toBe("");
		s.reset();
		const out = s.push("Hi\n") + s.finish();
		expect(out).toContain("Hi\n");
		expect(out).not.toContain("A");
	});

	it("normalizes CRLF newlines", () => {
		const s = createMarkdownStreamer({
			render: renderNoColor,
			spacing: "preserve",
		});
		const out = s.push("A\r\nB\r\n") + s.finish();
		expect(out).toContain("A\n");
		expect(out).toContain("B\n");
		expect(out).not.toContain("\r");
	});
});
