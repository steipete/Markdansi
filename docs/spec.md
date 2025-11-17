# Markdansi v0.1.2 – Design Spec

Goal: Tiny, dependency‑light Markdown → ANSI renderer & CLI for Node ≥22, using pnpm. Output is terminal ANSI only (no HTML). Focus on readable defaults, sensible wrapping, and minimal runtime deps.

## Core Dependencies (runtime)
- `micromark`, `micromark-extension-gfm`, `micromark-util-combine-extensions`: GFM parsing (tables, task lists, strikethrough, autolink literals).
- `chalk`: small, ESM‑only color/style helper.
- `string-width`: correct visible width (emoji / wide chars).
- `strip-ansi`: strip codes for width/wrapping.
- `supports-hyperlinks`: detect OSC‑8 hyperlink support.

Dev: `vitest`, TypeScript (NodeNext).

## Surface Area
### Library (ESM default, CJS export provided)
`render(markdown: string, options?: RenderOptions): string`

`createRenderer(options?: RenderOptions): (md: string) => string`

`type RenderOptions = {`
`  wrap?: boolean;            // default: true; if false => no hard wraps anywhere`
`  width?: number;            // used only when wrap===true; default: TTY cols or 80`
`  hyperlinks?: boolean;      // default: auto via supports-hyperlinks`
`  color?: boolean;           // default: true if TTY; if false => no ANSI/OSC at all`
`  theme?: ThemeName | Theme; // built-ins: default, dim, bright, solarized, monochrome, contrast`
`  listIndent?: number;       // spaces per nesting level; default 2`
`  quotePrefix?: string;      // blockquote line prefix; default "│ "`
`  tableBorder?: "unicode" | "ascii" | "none"; // default unicode box drawing`
`  tablePadding?: number;     // spaces inside cells (L/R); default 1`
`  tableDense?: boolean;      // reduce separator rows; default false`
`  tableTruncate?: boolean;   // truncate cells to fit col widths; default true`
`  tableEllipsis?: string;    // truncation marker; default "…"`
`  codeBox?: boolean;         // draw a box around fenced code; default true`
`  codeGutter?: boolean;      // left gutter with line numbers; default false`
`  codeWrap?: boolean;        // wrap code to width; default true`
`  highlighter?: (code: string, lang?: string) => string; // hook, must not add newlines`
`}``

`type Theme = { heading, strong, emph, inlineCode, blockCode, code?, link, quote, hr, listMarker, tableHeader, tableCell, tableBorder, tableSeparator }`
Each theme entry holds simple SGR intents (bold/italic/fg color names). `inlineCode` / `blockCode` are used if present; otherwise `code` acts as a fallback for both. Theme exposes defaults for table borders/separators; caller can override per render via options above.

`strip(markdown: string): string` — convenience: render with `color=false`, `hyperlinks=false`.

### CLI
`markdansi [--in FILE] [--out FILE] [--width N] [--no-wrap] [--no-color] [--no-links] [--theme default|dim|bright]`
- Input: stdin if no `--in`.
- Output: stdout if no `--out`.
- Wrap: on by default; `--no-wrap` disables; width auto from TTY when not provided.
- Links: OSC‑8 hyperlinks enabled when terminal supports; `--no-links` disables.

## Feature Scope (v1)
- Blocks: paragraphs, headings (1–6), blockquotes, fenced/indented code blocks, HR, tables, unordered/ordered lists, task lists.
- Inline: strong, emphasis, code spans, autolinks/links, strikethrough (GFM `~~`), backslash escapes.
- Code blocks: monospace box (unicode or ascii; `codeBox=false` disables). Optional gutter with 1‑based line numbers when `codeGutter=true`. If `lang` present, show faint header label. Highlighter hook may recolor text but must not add/remove newlines. Code blocks wrap to the available width by default (hard-wrap long tokens); set `codeWrap=false` to allow overflow.
- Tables: box-drawing (unicode default, ascii or none). Respect GFM alignment per column, pad cells by `tablePadding`, optional dense borders. Can truncate cell text (`tableTruncate=true`, `tableEllipsis` marker) to keep width. Width balancing shrinks columns while possible; if still too wide, cells overflow.
- Wrapping: word-wrap on spaces; uses `string-width` on stripped text. Preserve hard breaks; words longer than width may overflow. Code blocks wrap by default; turn off with `codeWrap=false`.
- Hyperlinks: OSC‑8 when supported and allowed; fallback to underlined text plus URL in parentheses.
- Error handling: never throw on malformed emphasis; leave literals untouched if unmatched.

## Rendering Pipeline
1) **Parse** via micromark with combined GFM extensions → AST events.
2) **Build light IR** (nodes: paragraph, heading, list, listItem, taskItem, table, tableRow, tableCell, code, inline text/emph/strong/del/code/link).
3) **Render** to ANSI:
   - Style map from theme to SGR codes.
   - Wrap paragraphs/table cells using `string-width` + `strip-ansi`; wrap only breaks on spaces.
   - OSC‑8 links when `hyperlinks` true; otherwise underline + optional URL suffix.
   - Track active SGR for wrapping splits to re-open styles on new lines.

## Themes (initial)
- `default`: bold headings, blue links, cyan inline code, green block code, yellow table headers, subtle quotes/hr.
- `dim`: muted colors for low-contrast terminals.
- `bright`: higher contrast variant.
- `solarized`: yellow headings, cyan inline, teal block code, blue links, yellow headers.
- `monochrome`: bold/italic cues only, dim code, underlined links.
- `contrast`: magenta headings, cyan inline, green block code, yellow headers, bright markers.

## Testing (vitest)
- Unit: inline formatting (emph/strong/code/strike), links/hyperlinks on/off, wrap/no-wrap behavior, table alignment and wrapping, task lists, strikethrough.
- Snapshot-ish string comparisons for representative documents (with colors off to avoid brittle codes).

## Non-Goals (v1)
- Images, footnotes, math, HTML passthrough, syntax highlighting bundle.

## Notes
- Highlighting: built-in is “label-only”; extensibility via `highlighter` hook. No extra deps added for highlighting.
- ESM-first; provide CJS export entry for compatibility.

## Behaviors & edge-case rules
- Wrap/width precedence: `wrap=false` disables all hard wrapping; `width` is ignored in that mode. When `wrap=true`, width is `options.width ?? ttyColumns ?? 80`.
- Color flag: `color=false` removes all ANSI/OSC output (no bold/italic/underline, no hyperlinks); output is plain text.
- Hyperlinks fallback: inline links render as `label (url)` when OSC‑8 disabled; autolinks render as the URL only. URLs count toward width.
- Highlighter hook: receives raw code and optional lang; may return ANSI-colored text but must not add or remove newlines. Markdansi owns indentation/padding; code blocks never hard-wrap.
- Tables width algorithm: compute desired column widths from content (cap at e.g. 40). While total exceeds width, decrement widest columns until it fits; if even minimums won’t fit, allow overflow. Respect GFM alignment per column. Cells with newlines keep those breaks. Optional truncation shortens cells before layout with `tableEllipsis`.
- Lists: honor GFM tight vs loose lists (tight => no blank line between items; loose => blank line). Nesting indent = 2 spaces per level; bullets use `-`; ordered lists use input numbering.
- Blockquotes: prefix each wrapped line with `│ ` (configurable via `quotePrefix`); quote content wraps accounting for the prefix width.
- List indent is configurable via `listIndent` (default 2 spaces per level).
- Reference-style definitions with indented title continuations are merged into a single paragraph (instead of becoming indented code blocks), preventing stray boxed output in copied logs.
