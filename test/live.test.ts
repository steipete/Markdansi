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
		expect(out).toContain("\r");
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

		expect(writes[2]).toContain("\u001b[0J");
		expect(writes[2]).toContain("b\r\n");
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
		expect(second).toContain("\u001b[0J");
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

		expect(writes[0]).toContain("\u001b[0J");
		expect(writes[0]).toContain("x\r\n");
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

	it("stops rendering when maxRows is exceeded", () => {
		const writes: string[] = [];
		let overflow: { rows: number; maxRows: number } | null = null;
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			maxRows: 2,
			onOverflow: (info) => {
				overflow = info;
			},
		});

		live.render("a\nb");
		const beforeOverflow = writes.length;
		live.render("a\nb\nc");
		const afterOverflow = writes.length;
		live.render("a");

		expect(overflow).toEqual({ rows: 3, maxRows: 2 });
		expect(afterOverflow).toBeGreaterThanOrEqual(beforeOverflow);
		expect(writes.length).toBe(afterOverflow);
	});

	it("clears scrollback when overflow is detected", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			maxRows: 1,
			clearScrollbackOnOverflow: true,
		});

		live.render("a");
		live.render("a\nb");

		const out = writes.join("");
		expect(out).toContain("\u001b[3J\u001b[2J\u001b[H");
	});

	it("renders only the tail rows when tailRows is set", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			tailRows: 2,
		});

		live.render("a\nb\nc");
		const last = writes[writes.length - 1] ?? "";

		expect(last).toContain("b\r\n");
		expect(last).toContain("c\r\n");
		expect(last).not.toContain("a\r\n");
	});

	it("does not overflow based on full height when tailRows is set", () => {
		const writes: string[] = [];
		let overflow: { rows: number; maxRows: number } | null = null;
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			tailRows: 2,
			maxRows: 2,
			onOverflow: (info) => {
				overflow = info;
			},
		});

		live.render("a\nb\nc\n");

		expect(overflow).toBeNull();
	});

	it("ignores appendWhenPossible when tailRows is set", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			tailRows: 2,
			appendWhenPossible: true,
		});

		live.render("hello\n");
		live.render("hello\nworld\n");

		expect(writes[0]).toContain("\u001b[0J");
		expect(writes[1]).toContain("\u001b[0J");
	});

	it("appends when the rendered frame grows by prefix", () => {
		const writes: string[] = [];
		const live = createLiveRenderer({
			write: (chunk) => writes.push(chunk),
			renderFrame: (input) => input,
			appendWhenPossible: true,
		});

		live.render("hello\n");
		live.render("hello\nworld\n");

		expect(writes[0]).toContain("\u001b[0J");
		expect(writes[1]).not.toContain("\u001b[0J");
		const out = writes.join("");
		expect(out).toContain("hello");
		expect(out).toContain("world");
	});
});
