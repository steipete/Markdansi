import type { WriteStream } from "node:tty";
import { createSupportsHyperlinks } from "supports-hyperlinks";

/**
 * Detect OSC-8 hyperlink support for a given stream (defaults to stdout).
 */
export function hyperlinkSupported(stream: WriteStream = process.stdout): boolean {
  return createSupportsHyperlinks(stream);
}

/**
 * Build an OSC-8 hyperlink sequence.
 */
export function osc8(url: string, text: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}
