import ansiRegex from "ansi-regex";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { createMarkdownStreamer, render } from "../src/index.ts";
import { wrapText } from "../src/wrap.ts";

const progress = "\u001b]9;4;3;;Waiting for API\u001b\\";
const done = "\u001b]9;4;0\u0007";
const controls = (text: string) => text.match(ansiRegex()) ?? [];

describe("terminal control preservation", () => {
  it.each([6, 80])("preserves OSC progress controls when rendering at width %i", (width) => {
    const output = render(`${progress}Please provide design${done}`, { width, color: true });
    expect(controls(output)).toEqual([progress, done]);
    expect(stripAnsi(output)).toBe(
      width === 6 ? "Please\nprovide\ndesign\n" : "Please provide design\n",
    );
  });

  it("still removes input controls when color is disabled", () => {
    expect(render(`${progress}Ready${done}`, { color: false })).toBe("Ready\n");
  });

  it("preserves OSC controls split across streamed chunks", () => {
    const streamer = createMarkdownStreamer({
      render: (markdown) => render(markdown, { width: 6, color: true }),
    });
    const output =
      streamer.push(progress.slice(0, 5)) +
      streamer.push(`${progress.slice(5)}Please provide design${done.slice(0, -1)}`) +
      streamer.finish(`${done.slice(-1)}\n`);
    expect(controls(output)).toEqual([progress, done]);
  });

  it.each([
    `${progress}中文 中文${done}`,
    `中文 ${progress}中文${done}`,
    `中文${progress}\n中文${done}`,
    `${progress}${done}`,
    `中文 ${progress} ${done}`,
  ])("preserves each control once across wraps, gaps, and hard breaks: %j", (text) => {
    expect(controls(wrapText(text, 4, true).join("\n"))).toEqual([progress, done]);
  });
});
