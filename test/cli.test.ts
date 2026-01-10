import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { isDirectCliInvocation } from "../src/cli.ts";

describe("cli entry detection", () => {
	it("treats .. paths as the same entrypoint", () => {
		const cliPath = path.resolve("src", "cli.ts");
		const argv1 = cliPath.replace(
			`${path.sep}src${path.sep}cli.ts`,
			`${path.sep}src${path.sep}..${path.sep}src${path.sep}cli.ts`,
		);
		expect(cliPath).not.toBe(argv1);
		expect(isDirectCliInvocation(pathToFileURL(cliPath).href, argv1)).toBe(
			true,
		);
	});
});
