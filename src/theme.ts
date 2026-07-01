import type { ChalkInstance } from "chalk";
import { Chalk } from "chalk";
import type { StyleIntent, Theme, ThemeName } from "./types.js";

const base: Theme = {
  heading: { color: "yellow", bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { color: "cyan" },
  blockCode: { color: "green" },
  link: { color: "blue", underline: true },
  quote: { dim: true },
  hr: { dim: true },
  listMarker: { color: "cyan" },
  tableHeader: { bold: true, color: "yellow" },
  tableCell: {},
};

const dim: Theme = {
  ...base,
  heading: { color: "white", bold: true, dim: true },
  link: { color: "blue", underline: true, dim: true },
};

const bright: Theme = {
  ...base,
  heading: { color: "magenta", bold: true },
  link: { color: "cyan", underline: true },
  inlineCode: { color: "green" },
  blockCode: { color: "green" },
};

const solarized: Theme = {
  heading: { color: "yellow", bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { color: "cyan" },
  blockCode: { color: "#2aa198" },
  link: { color: "blue", underline: true },
  quote: { color: "white", dim: true },
  hr: { color: "white", dim: true },
  listMarker: { color: "cyan" },
  tableHeader: { color: "yellow", bold: true },
};

const monochrome: Theme = {
  heading: { bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { dim: true },
  blockCode: { dim: true },
  link: { underline: true },
  quote: { dim: true },
  hr: { dim: true },
  listMarker: { dim: true },
  tableHeader: { bold: true },
};

const contrast: Theme = {
  heading: { color: "magenta", bold: true },
  strong: { color: "white", bold: true },
  emph: { color: "white", italic: true },
  inlineCode: { color: "cyan", bold: true },
  blockCode: { color: "green", bold: true },
  link: { color: "blue", underline: true },
  quote: { color: "white", dim: true },
  hr: { color: "white", dim: true },
  listMarker: { color: "yellow", bold: true },
  tableHeader: { color: "yellow", bold: true },
  tableCell: { color: "white" },
};

export type Themes = Record<ThemeName, Theme> & Record<string, Theme>;

export const themes: Themes = {
  default: Object.freeze(base),
  dim: Object.freeze(dim),
  bright: Object.freeze(bright),
  solarized: Object.freeze(solarized),
  monochrome: Object.freeze(monochrome),
  contrast: Object.freeze(contrast),
};

export type Styler = (text: string, style?: StyleIntent) => string;

/**
 * Create a Chalk-based styling helper that applies StyleIntent safely.
 */
export function createStyler({ color }: { color: boolean }): Styler {
  const level = color ? 3 : 0;
  const chalk = new Chalk({ level }) as ChalkInstance;
  const apply: Styler = (text, style = {}) => {
    if (!color) return text;
    let fn: ChalkInstance = chalk;
    if (style.color) {
      const indexed = fn as unknown as Record<string, ChalkInstance | undefined>;
      if (indexed[style.color]) fn = indexed[style.color] as ChalkInstance;
    }
    if (style.bgColor) {
      const indexed = fn as unknown as Record<string, ChalkInstance | undefined>;
      if (indexed[style.bgColor]) fn = indexed[style.bgColor] as ChalkInstance;
    }
    if (style.bold) fn = fn.bold;
    if (style.italic) fn = fn.italic;
    if (style.underline) fn = fn.underline;
    if (style.dim) fn = fn.dim;
    if (style.strike) fn = fn.strikethrough;
    return fn(text);
  };
  return apply;
}
