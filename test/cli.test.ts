import { execFileSync } from "node:child_process";
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
    expect(parseArgs(["node", "cli", "--in", "explicit.md", "ignored.md"])).toMatchObject({
      in: "explicit.md",
    });
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
});
