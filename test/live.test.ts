import { describe, expect, it } from "vitest";
import { createLiveRenderer } from "../src/live.js";

describe("live renderer", () => {
	it("emits synchronized frames with cursor control sequences", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
		});

		live.render("hello");
		live.render("hello\nworld");
		live.finish();

		const out = writes.join("");
		expect(out).toContain("\u001b[?2026h");
		expect(out).toContain("\u001b[?2026l");
		expect(out).toContain("\u001b[0J");
		expect(out).toContain("\u001b[?25l");
		expect(out).toContain("\u001b[?25h");
		expect(out).toContain("\u001b[1A\r");
	});

	it("does not move the cursor up on the first frame", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
		});

		live.render("hello");

		expect(writes[0]).not.toContain("\u001b[1A");
		expect(writes[0]).not.toContain("\u001b[2A");
		expect(writes[0]).toContain("\r");
	});

	it("can disable synchronized output framing", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			synchronizedOutput: false,
		});

		live.render("hello");
		live.finish();

		const out = writes.join("");
		expect(out).not.toContain("\u001b[?2026h");
		expect(out).not.toContain("\u001b[?2026l");
		expect(out).toContain("\u001b[0J");
	});

	it("can disable cursor hiding", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			hideCursor: false,
		});

		live.render("hello");
		live.finish();

		const out = writes.join("");
		expect(out).not.toContain("\u001b[?25l");
		expect(out).not.toContain("\u001b[?25h");
	});

	it("keeps the overwrite region stable when the frame shrinks", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
		});

		live.render("a\nb\nc");
		live.render("a");
		live.render("a\nb");

		expect(writes[2]).toContain("\u001b[1A\r");
	});

	it("clears removed lines when the frame shrinks", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
		});

		live.render("a\nb\nc");
		live.render("a");

		const second = writes[1];
		expect(second).toContain("\u001b[3A\r");
		expect(second).toContain("\u001b[0J");
		expect(second).toContain("a\r\n");
		expect(second).not.toContain("b");
		expect(second).not.toContain("c");
	});

	it("adds a trailing newline when renderFrame omits it", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: () => "x",
		});

		live.render("ignored");

		expect(writes[0]).toContain("\u001b[0J\rx\r\n");
	});

	it("finish is a no-op if cursor was never hidden", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			hideCursor: false,
		});

		live.finish();
		expect(writes).toEqual([]);
	});
});
