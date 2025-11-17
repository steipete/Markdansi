# 🎨 Markdansi: Wraps, colors, links—no baggage.
![npm](https://img.shields.io/npm/v/markdansi) ![license MIT](https://img.shields.io/badge/license-MIT-blue.svg) ![node >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen) ![tests vitest](https://img.shields.io/badge/tests-vitest-blue?logo=vitest)

Tiny, dependency-light Markdown → ANSI renderer and CLI for modern Node (>=22). Focuses on readable terminal output with sensible wrapping, GFM support (tables, task lists, strikethrough), optional OSC‑8 hyperlinks, and zero built‑in syntax highlighting (pluggable hook). Written in TypeScript, ships ESM.

Published on npm as `markdansi`.

## Install

```bash
pnpm add markdansi
# or
npm install markdansi
```

## CLI

```bash
markdansi [--in FILE] [--out FILE] [--width N] [--no-wrap] [--no-color] [--no-links] [--theme default|dim|bright]
[--list-indent N] [--quote-prefix STR]
```

- Input: stdin if `--in` not given (use `--in -` for stdin explicitly).
- Output: stdout unless `--out` provided.
- Wrapping: on by default; `--no-wrap` disables hard wrapping.
- Links: OSC‑8 when supported; `--no-links` disables.
- Lists/quotes: `--list-indent` sets spaces per nesting level (default 2); `--quote-prefix` sets blockquote prefix (default `│ `).

## Library

```js
import { render, createRenderer, strip, themes } from 'markdansi';

const ansi = render('# Hello **world**', { width: 60 });

const renderNoWrap = createRenderer({ wrap: false });
const out = renderNoWrap('A very long line...');

// Plain text (no ANSI/OSC)
const plain = strip('link to [x](https://example.com)');

// Custom theme and highlighter hook
const custom = createRenderer({
  theme: {
    ...themes.default,
    code: { color: 'cyan', dim: true }, // fallback used for inline/block
    inlineCode: { color: 'red' },
    blockCode: { color: 'green' },
  },
  highlighter: (code, lang) => code.toUpperCase(),
});
console.log(custom('`inline`\n\n```\nblock code\n```'));
```

### Options

- `wrap` (default `true`): if `false`, no hard wrapping anywhere.
- `width`: used only when `wrap===true`; default TTY columns or 80.
- `color` (default TTY): `false` removes all ANSI/OSC.
- `hyperlinks` (default auto): enable/disable OSC‑8 links.
- `theme`: `default | dim | bright | solarized | monochrome | contrast` or custom theme object.
- `listIndent`: spaces per nesting level (default 2).
- `quotePrefix`: blockquote line prefix (default `│ `).
- `tableBorder`: `unicode` (default) | `ascii` | `none`.
- `tablePadding`: spaces inside cells (default 1); `tableDense` drops extra separators.
- `tableTruncate`: cap cells to column width (default `true`, ellipsis `…`).
- `codeBox`: draw a box around fenced code (default true); `codeGutter` shows line numbers; `codeWrap` wraps code lines by default.
- `highlighter(code, lang)`: optional hook to recolor code blocks; must not add/remove newlines.

## Status

Version: `0.1.2` (released)  
Tests: `pnpm test`  
License: MIT

## Notes

- Code blocks wrap to the render width by default; disable with `codeWrap=false`. If `lang` is present, a faint `[lang]` label is shown and boxes use unicode borders.
- Link/reference definitions that spill their titles onto indented lines are merged back into one line so copied notes don’t turn into boxed code.
- Tables use unicode borders by default, include padding, respect GFM alignment, and truncate long cells with `…` so layouts stay tidy. Turn off truncation with `tableTruncate=false`.
- Tight vs loose lists follow GFM; task items render `[ ]` / `[x]`.

See `docs/spec.md` for full behavior details.*** End Patch
