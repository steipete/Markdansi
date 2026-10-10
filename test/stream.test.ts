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

  it.each(["```", "~~~", "````"])("buffers unlabelled %s fences and preserves code", (fence) => {
    const s = createMarkdownStreamer({ render: renderNoColor });
    const code = "**literal**\n- keep marker\n";
    expect(s.push(`${fence}\n`)).toBe("");
    expect(s.push(code)).toBe("");
    expect(s.finish(fence)).toBe(`${renderNoColor(`${fence}\n${code}${fence}`).trimEnd()}\n`);
    expect(s.finish()).toBe("");
  });

  it("flushes an unclosed unlabelled fence on finish", () => {
    const s = createMarkdownStreamer({ render: renderNoColor });
    expect(s.push("```\n**literal**\n")).toBe("");
    expect(s.finish()).toBe("**literal**\n");
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
    const out = s.push("## Overview\n\n- One\n\n## Key Evidence\n- Two\n") + s.finish();
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

  it.each(["| A | B |\n", "| A | B |\n|---|---|\n| 1 | 2 |\n", "```txt\nunfinished code\n"])(
    "reset discards pending blocks and spacing: %j",
    (markdown) => {
      const s = createMarkdownStreamer({ render: renderNoColor, spacing: "preserve" });
      expect(s.push("Before\n\n")).toBe("Before\n\n");
      expect(s.push(markdown)).toBe("");
      s.reset();
      expect(s.push("\nAfter\n") + s.finish()).toBe("After\n");
    },
  );

  it.each(["| A | B |", "| A | B |\n|---|---|\n| 1 | 2 |"])(
    "finish flushes a pending header or table exactly once: %j",
    (markdown) => {
      const s = createMarkdownStreamer({ render: renderNoColor });
      expect(s.push(markdown)).toBe("");
      expect(s.finish()).toBe(`${renderNoColor(markdown).trimEnd()}\n`);
      expect(s.finish()).toBe("");
    },
  );

  it("flushes a table before buffering a fence and resumes after the fence", () => {
    const s = createMarkdownStreamer({ render: renderNoColor });
    const table = "| A | B |\n|---|---|\n| 1 | 2 |\n";
    expect(s.push(table)).toBe("");
    expect(s.push("```txt\n")).toBe(`${renderNoColor(table).trimEnd()}\n`);
    expect(s.push("inside\n")).toBe("");
    expect(s.finish("```\nAfter")).toBe("inside\nAfter\n");
    expect(s.finish()).toBe("");
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
