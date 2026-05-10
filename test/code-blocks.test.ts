import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { render, strip } from "../src/index.ts";

const noColor = { color: false, hyperlinks: false, wrap: true, width: 40 };

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

  it("renders language label in code box header (multi-line only)", () => {
    const md = "```bash\nthis line is definitely longer than the label\nand still flows\n```";
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
    const md = "```\nfoo\nbar\n```";
    const out = render(md, { color: false, wrap: false });
    const firstLine = out.split("\n")[0];
    expect(firstLine.startsWith("┌")).toBe(true);
    expect(firstLine).not.toContain("[");
  });

  it("keeps header width when label is long", () => {
    const md = "```superlonglanguageid\nfoo\nbar\n```";
    const out = render(md, { color: false, wrap: false });
    const lines = out.split("\n");
    const top = lines[0];
    const body = lines[1];
    // Header should be wider or equal to body content
    expect(top.length).toBeGreaterThanOrEqual(body.length - 2 /* box padding */);
    expect(top).toContain("[superlonglanguageid]");
  });

  it("does not emit blank line before boxed code", () => {
    const md = "```bash\nfoo\nbar\n```";
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

  it("collapses lists of code blocks into a single block", () => {
    const md = "- ```\n  first\n  ```\n- ```\n  second\n  ```";
    const out = render(md, { color: false, wrap: false });
    const boxes = (out.match(/┌/g) ?? []).length;
    expect(boxes).toBe(1);
    expect(out).toContain("first");
    expect(out).toContain("second");
  });

  it("tags unfenced diffs and skips wrapping them", () => {
    const md =
      "```\n--- a/foo\n+++ b/foo\n@@ -1 +1 @@\n- a very very very very long line\n+ another very very very very long line\n```";
    const out = render(md, { color: false, wrap: true, width: 20 });
    expect(out).toContain("[diff]");
    const minusLine = out.split("\n").find((l) => l.includes("very very very very long line"));
    expect(minusLine?.length).toBeGreaterThan(30);
  });

  it("renders single-line code blocks without a box", () => {
    const md = "```\nsolo\n```";
    const out = render(md, { color: false, wrap: false });
    expect(out.startsWith("┌")).toBe(false);
    expect(out.trim()).toBe("solo");
  });
});
