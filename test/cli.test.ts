import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isDirectCliInvocation, parseArgs } from "../src/cli.ts";

describe("cli entry detection", () => {
  it("treats .. paths as the same entrypoint", () => {
    const cliPath = path.resolve("src", "cli.ts");
    const argv1 = cliPath.replace(
      `${path.sep}src${path.sep}cli.ts`,
      `${path.sep}src${path.sep}..${path.sep}src${path.sep}cli.ts`,
    );
    expect(cliPath).not.toBe(argv1);
    expect(isDirectCliInvocation(pathToFileURL(cliPath).href, argv1)).toBe(true);
  });
});

describe("cli input args", () => {
  it("uses the first positional argument as the input file", () => {
    expect(parseArgs(["node", "cli", "input.md", "--no-color"])).toMatchObject({
      in: "input.md",
      color: false,
    });
  });

  it("keeps explicit --in ahead of later positional arguments", () => {
    expect(() => parseArgs(["node", "cli", "--in", "explicit.md", "ignored.md"])).toThrow(
      "unexpected positional argument: ignored.md",
    );
  });

  it.each(["default", "dim", "bright", "solarized", "monochrome", "contrast"])(
    "accepts the built-in %s theme",
    (theme) => {
      expect(parseArgs(["node", "cli", "--theme", theme])).toMatchObject({ theme });
    },
  );

  it("accepts a documented separate table border value", () => {
    expect(parseArgs(["node", "cli", "--table-border", "ascii"])).toMatchObject({
      tableBorder: "ascii",
    });
  });

  it("accepts dash-prefixed text values and bare code flags", () => {
    expect(
      parseArgs([
        "node",
        "cli",
        "--quote-prefix",
        "-- ",
        "--table-ellipsis",
        "--",
        "--code-wrap",
        "--code-box",
        "--code-gutter",
      ]),
    ).toMatchObject({
      quotePrefix: "-- ",
      tableEllipsis: "--",
      codeWrap: true,
      codeBox: true,
      codeGutter: true,
    });
  });

  it.each([
    [["--width", "nope"], "--width must be a positive integer"],
    [["--width", " "], "--width must be a positive integer"],
    [["--width", "0"], "--width must be a positive integer"],
    [["--list-indent", ""], "--list-indent must be a non-negative integer"],
    [["--list-indent", "-1"], "--list-indent must be a non-negative integer"],
    [["--table-padding", "1.5"], "--table-padding must be a non-negative integer"],
    [
      ["--theme", "neon"],
      "--theme must be one of: default, dim, bright, solarized, monochrome, contrast",
    ],
    [["--table-border", "rounded"], "--table-border must be unicode, ascii, or none"],
    [["--width"], "--width requires a value"],
    [["--wat"], "unknown option: --wat"],
  ])("rejects invalid arguments: %j", (input, message) => {
    expect(() => parseArgs(["node", "cli", ...input])).toThrow(message);
  });

  it("renders a positional file instead of reading stdin", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "markdansi-cli-"));
    try {
      const inputPath = path.join(tempDir, "input.md");
      fs.writeFileSync(inputPath, "# Positional\n\nHello from file\n", "utf8");

      const output = execFileSync(
        "pnpm",
        ["exec", "tsx", "src/cli.ts", inputPath, "--no-color", "--no-links", "--no-wrap"],
        { encoding: "utf8", input: "" },
      );

      expect(output).toContain("Positional");
      expect(output).toContain("Hello from file");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("applies documented table and code rendering flags", () => {
    const input = "| A | B |\n| - | - |\n| x | y |\n\n```ts\nconst x = 1;\n```\n";
    const output = execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "src/cli.ts",
        "--no-color",
        "--no-links",
        "--table-border",
        "ascii",
        "--code-box=false",
      ],
      { encoding: "utf8", input },
    );

    expect(output).toContain("+----+----+");
    expect(output).not.toContain("┌");
    expect(output).toContain("const x = 1;");
  });

  it("renders with an extended built-in theme", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "src/cli.ts", "--theme", "solarized", "--no-color", "--no-links"],
      { encoding: "utf8", input: "# Solarized\n" },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Solarized");
  });

  it("reports invalid numeric options without a stack trace", () => {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "src/cli.ts", "--width", "nope", "--no-color"],
      { encoding: "utf8", input: "hello\n" },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("markdansi: --width must be a positive integer");
    expect(result.stderr).not.toContain("src/cli.ts:");
  });
});
