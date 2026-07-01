export type ColorName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | `#${string}`
  | `${number}`;

export type StyleIntent = {
  color?: ColorName;
  bgColor?: ColorName;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
  strike?: boolean;
};

export type Theme = {
  heading?: StyleIntent;
  strong?: StyleIntent;
  emph?: StyleIntent;
  inlineCode?: StyleIntent;
  blockCode?: StyleIntent;
  code?: StyleIntent;
  link?: StyleIntent;
  quote?: StyleIntent;
  hr?: StyleIntent;
  listMarker?: StyleIntent;
  tableHeader?: StyleIntent;
  tableCell?: StyleIntent;
};

export const themeNames = [
  "default",
  "dim",
  "bright",
  "solarized",
  "monochrome",
  "contrast",
] as const;

export type ThemeName = (typeof themeNames)[number];

export type Highlighter = (code: string, lang?: string) => string;

export interface RenderOptions {
  wrap?: boolean;
  width?: number;
  hyperlinks?: boolean;
  color?: boolean;
  theme?: ThemeName | Theme;
  /**
   * Spaces per nesting level for lists (default 2).
   */
  listIndent?: number;
  /**
   * Prefix used for blockquotes (default "│ ").
   */
  quotePrefix?: string;
  /** Table border style: unicode (default), ascii, or none. */
  tableBorder?: "unicode" | "ascii" | "none";
  /** Spaces around cell content (default 1). */
  tablePadding?: number;
  /** If true, reduces separator rows (default false). */
  tableDense?: boolean;
  /** If true, truncates cell content to fit column width (default true). */
  tableTruncate?: boolean;
  /** Ellipsis text for truncation (default "…"). */
  tableEllipsis?: string;
  /** Draw a box around fenced code blocks (default true). */
  codeBox?: boolean;
  /** Show line-number gutter for code blocks (default false). */
  codeGutter?: boolean;
  /** Wrap code lines to width; otherwise overflow (default true). */
  codeWrap?: boolean;
  highlighter?: Highlighter;
}
