import supportsHyperlinks from "supports-hyperlinks";
import { describe, expect, it, vi } from "vitest";
import { handleStdoutEpipe, parseArgs } from "../src/cli.ts";
import { hyperlinkSupported } from "../src/hyperlink.ts";
import { render, strip } from "../src/index.ts";
import { createStyler, themes } from "../src/theme.ts";
import { visibleWidth, wrapText } from "../src/wrap.ts";

const noColor = { color: false, hyperlinks: false, wrap: true, width: 40 };

describe("inline formatting", () => {
  it("renders emphasis/strong/code/strike", () => {
    const out = strip("Hello _em_ **strong** `code` ~~gone~~", noColor);
    expect(out).toContain("Hello em strong code gone");
  });

  it("decodes named and numeric character references", () => {
    expect(strip("A &amp; B &#38; C &#x26; D", noColor).trim()).toBe("A & B & C & D");
    expect(strip("&#128; &#xD800; &#x110000;", noColor).trim()).toBe("� � �");
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

  it("collapses soft line breaks to spaces", () => {
    const out = strip("Hello\nworld", {
      ...noColor,
      wrap: true,
      width: 80,
    }).trimEnd();
    expect(out).toBe("Hello world");
  });

  it("collapses soft line breaks and trims indentation", () => {
    const out = strip("Hello\n  world", { ...noColor, width: 200 }).trimEnd();
    expect(out).toBe("Hello world");
  });

  it("keeps hard breaks (two-space newline)", () => {
    const out = strip("line one  \nline two", {
      ...noColor,
      wrap: true,
      width: 80,
    }).trimEnd();
    expect(out.split("\n").length).toBeGreaterThan(1);
  });

  it("keeps hard breaks even with surrounding soft breaks", () => {
    const out = strip("a\nb  \nc", { ...noColor, width: 200 }).trimEnd();
    expect(out).toContain("a b\nc");
  });

  it("ignores inline HTML content safely", () => {
    const out = strip("<div>ignored</div>", { ...noColor });
    expect(out).toBe("");
  });

  it("preserves inline HTML text", () => {
    expect(strip("a <span>b</span> c", noColor).trim()).toBe("a <span>b</span> c");
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

  it("avoids orphaned trailing articles when wrapping", () => {
    const md =
      '* **Section IV (signature):** A concluding line stating the document was "typed on 2025-12-18 with a stubborn cursor."';
    const out = strip(md, { ...noColor, width: 100, wrap: true }).trimEnd();
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toMatch(/\bwith a\s*$/);
    expect(lines[1]).toContain("with a stubborn cursor.");
  });

  it("moves a trailing article to the next line when possible", () => {
    expect(wrapText("hello the world", 11, true)).toEqual(["hello", "the world"]);
  });

  it("moves a trailing preposition+article phrase to the next line when possible", () => {
    expect(wrapText("walk in the rain", 11, true)).toEqual(["walk", "in the rain"]);
  });

  it("keeps the whole preposition when an orphan phrase has extra spaces", () => {
    const out = strip("Run the tool with  the cache enabled and watch.", { ...noColor, width: 22 });
    expect(out).toBe("Run the tool\nwith  the cache\nenabled and watch.\n");
  });

  it("keeps extra spaces in orphan phrases inside wrapped table cells", () => {
    const out = strip("| note |\n|---|\n| Run the tool with  the cache enabled |", {
      ...noColor,
      width: 30,
      tableBorder: "ascii",
      tableTruncate: false,
    });
    expect(out).toContain("| Run the tool             |\n| with  the cache enabled  |");
  });

  it("does not treat punctuated words as orphan candidates", () => {
    expect(wrapText("hello the, world", 11, true)).toEqual(["hello the,", "world"]);
  });

  it("counts Unicode spacing marks when wrapping", () => {
    expect(wrapText("का ख", 3, true)).toEqual(["का", "ख"]);
  });
});

describe("lists and tasks", () => {
  it("renders task list items", () => {
    const out = strip("- [ ] open\n- [x] done", noColor);
    expect(out).toContain("[ ] open");
    expect(out).toContain("[x] done");
  });

  it("collapses soft line breaks inside list items", () => {
    const md =
      '- Section IV (signature): A concluding line stating the document was "typed on 2025-12-18 with a\n' +
      '  stubborn cursor."';
    const out = strip(md, { ...noColor, width: 200 }).trimEnd();
    expect(out).toContain("with a stubborn cursor.");
    expect(out).not.toContain("\n\n");
  });

  it("splits loose lists with blank line", () => {
    const out = strip("- item 1\n\n- item 2", noColor);
    expect(out.split("\n").filter((l) => l === "").length).toBeGreaterThan(0);
  });

  it("keeps ordered lists separate around blockquotes", () => {
    const out = strip("1. first\n> quote\n2. second\n> quote", noColor);
    expect(out).toContain("1. first\n│ quote\n2. second\n│ quote");
  });

  it("indents each nested list level", () => {
    const out = strip("- one\n  - two\n    - three\n      - four\n- back", noColor);
    expect(out).toBe("- one\n  - two\n    - three\n      - four\n- back\n");
  });

  it("keeps code indentation inside list items", () => {
    const md = "- item\n\n  ```\n  def main():\n      return 1\n  ```";
    const out = strip(md, { ...noColor, codeBox: false });
    expect(out).toBe("- item\n  def main():\n      return 1\n\n");
  });

  it("wraps list item content to the width left beside the marker", () => {
    const out = strip("1. Wrap numbered list rows well", { ...noColor, width: 30 });
    expect(out).toBe("1. Wrap numbered list rows\n  well\n");
  });

  it.each([0, 4])("uses listIndent %i at every nested level", (listIndent) => {
    const out = strip("- one\n  - two\n    - three", { ...noColor, listIndent });
    expect(out).toBe(
      `- one\n${" ".repeat(listIndent)}- two\n${" ".repeat(listIndent * 2)}- three\n`,
    );
  });

  it.each(["99.", "- [ ]", "- [x]"])("fits styled %s markers within the width", (marker) => {
    const out = render(`${marker} alpha beta gamma delta epsilon zeta`, {
      ...noColor,
      color: true,
      width: 24,
    });
    expect(out).toContain("\u001b[");
    expect(
      out
        .trimEnd()
        .split("\n")
        .every((line) => visibleWidth(line) <= 24),
    ).toBe(true);
  });

  it.each([
    "```\nabcdefghijklmnopqrstuvwxyz0123456789\n```",
    "---",
    "| label |\n| --- |\n| abcdefghijklmnopqrstuvwxyz0123456789 |",
  ])("fits child blocks within the list width: %s", (block) => {
    const md = `- item\n\n${block
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}`;
    const out = strip(md, { ...noColor, width: 24, codeBox: false });
    expect(
      out
        .trimEnd()
        .split("\n")
        .every((line) => visibleWidth(line) <= 24),
    ).toBe(true);
  });

  it("preserves nested indentation when wrapping is disabled", () => {
    const md = "- one\n  - two\n    - three with a longer line";
    const out = strip(md, { ...noColor, width: 8, wrap: false });
    expect(out).toBe(`${md}\n`);
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
    expect(out).toContain("\u001B]8;;https://example.com\u0007x\u001B]8;;\u0007");
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

describe("cli stdout EPIPE handling", () => {
  it("exits cleanly on EPIPE", () => {
    const exitSpy = vi.spyOn(process, "exit").mockReturnValue(undefined as never);
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

  it("applies named, hex, and ANSI-256 foreground and background colors", () => {
    const style = createStyler({ color: true });

    expect(style("x", { color: "#2aa198" })).toContain("\u001b[38;2;42;161;152m");
    expect(style("x", { bgColor: "#2aa198" })).toContain("\u001b[48;2;42;161;152m");
    expect(style("x", { color: "42" })).toContain("\u001b[38;5;42m");
    expect(style("x", { bgColor: "42" })).toContain("\u001b[48;5;42m");
    expect(style("x", { bgColor: "blue" })).toContain("\u001b[44m");
  });

  it("applies the Solarized block-code color", () => {
    const ansi = render("```\nblock\n```", {
      color: true,
      theme: "solarized",
      wrap: false,
      codeBox: false,
    });

    expect(ansi).toContain("\u001b[38;2;42;161;152m");
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
