# 🎨 Markdansi: Wraps, colors, links—no baggage.

<p align="center">
  <img src="./markdansi.png" alt="Markdansi README header" width="1100">
</p>

![npm](https://img.shields.io/npm/v/markdansi) ![license MIT](https://img.shields.io/badge/license-MIT-blue.svg) ![node >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen) ![tests vitest](https://img.shields.io/badge/tests-vitest-blue?logo=vitest)

Tiny, dependency-light Markdown → ANSI renderer and CLI for modern Node (>=22). Focuses on readable terminal output with sensible wrapping, GFM support (tables, task lists, strikethrough), optional OSC‑8 hyperlinks, and zero built‑in syntax highlighting (pluggable hook). Written in TypeScript, ships ESM.

Published on npm as `markdansi`.

## Install
Grab it from npm; no native deps, so install is instant on Node 22+.

```bash
bun add markdansi
# or
pnpm add markdansi
# or
npm install markdansi
```

## CLI
Quick one-shot renderer: pipe Markdown in, ANSI comes out. Flags let you pick width, wrap, colors, links, and table/list styling.

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
Use the renderer directly in Node/TS for customizable theming, optional syntax highlighting hooks, and OSC‑8 link control.

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

// Example: real syntax highlighting with Shiki (TS + Swift)
import { bundledLanguages, bundledThemes, createHighlighter } from 'shiki';

const shiki = await createHighlighter({
  themes: [bundledThemes['github-dark']],
  langs: [bundledLanguages.typescript, bundledLanguages.swift],
});

const highlighted = createRenderer({
  highlighter: (code, lang) => {
    if (!lang) return code;
    const normalized = lang.toLowerCase();
    if (!['ts', 'typescript', 'swift'].includes(normalized)) return code;
    const { tokens } = shiki.codeToTokens(code, {
      lang: normalized === 'swift' ? 'swift' : 'ts',
      theme: 'github-dark',
    });
    return tokens
      .map((line) =>
        line
          .map((token) =>
            token.color ? `\u001b[38;2;${parseInt(token.color.slice(1, 3), 16)};${parseInt(
              token.color.slice(3, 5),
              16,
            )};${parseInt(token.color.slice(5, 7), 16)}m${token.content}\u001b[39m` : token.content,
          )
          .join(''),
      )
      .join('\n');
  },
});
console.log(highlighted('```ts\nconst x: number = 1\n```\n```swift\nlet x = 1\n```'));
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

Version: `0.1.3` (released)  
Tests: `pnpm test`  
License: MIT

## Notes

- Code blocks wrap to the render width by default; disable with `codeWrap=false`. If `lang` is present, a faint `[lang]` label is shown and boxes use unicode borders.
- Link/reference definitions that spill their titles onto indented lines are merged back into one line so copied notes don’t turn into boxed code.
- Tables use unicode borders by default, include padding, respect GFM alignment, and truncate long cells with `…` so layouts stay tidy. Turn off truncation with `tableTruncate=false`.
- Tight vs loose lists follow GFM; task items render `[ ]` / `[x]`.

See `docs/spec.md` for full behavior details.

Looking for the Swift port? Check out [Swiftdansi](https://github.com/steipete/Swiftdansi).
