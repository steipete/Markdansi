# Markdansi 🎨 — Markdown, dressed for the terminal.

[![CI](https://img.shields.io/github/actions/workflow/status/steipete/Markdansi/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/steipete/Markdansi/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/markdansi?style=flat-square)](https://www.npmjs.com/package/markdansi)
[![Node.js](https://img.shields.io/node/v/markdansi?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/steipete/Markdansi?style=flat-square)](LICENSE)

<p align="center">
  <img src="./markdansi.png" alt="Markdansi rendering Markdown in a terminal" width="1024">
</p>

Markdansi renders GitHub Flavored Markdown as wrapped ANSI output for Node.js terminals. Use it as a CLI, an ESM library, or an append-only streamer for incremental output.

## Install

Markdansi requires Node.js 22 or newer. Run the CLI without installing it:

```sh
npx markdansi README.md
```

Add the CLI and library to a project with your package manager:

```sh
npm install markdansi
```

## Quick start

Pipe Markdown to the CLI and it writes rendered output to stdout:

```console
$ printf '# Hello, **terminal**\n\n- wraps Markdown\n- formats tables\n' | npx markdansi --no-color --width 50

Hello, terminal
- wraps Markdown
- formats tables
```

Omit `--no-color` for ANSI styles and OSC-8 links when the terminal supports them.

## Use as a library

```js
import { render } from "markdansi";

const output = render("# Hello **terminal**", { width: 60 });
process.stdout.write(output);
```

Markdansi ships as ESM. CommonJS callers can load it with `import("markdansi")`.

`createRenderer()` binds options for repeated renders, while `strip()` produces plain text without ANSI or hyperlinks:

```js
import { createRenderer, strip } from "markdansi";

const renderNarrow = createRenderer({ width: 48, theme: "dim" });
console.log(renderNarrow("## Status\n\nEverything is **ready**."));
console.log(strip("Read [the docs](https://example.com)."));
```

## Stream incremental Markdown

`createMarkdownStreamer()` emits completed fragments without cursor movement or in-place redraw. Regular lines are emitted as they arrive; fenced code blocks and tables are buffered until they are complete.

```js
import { createMarkdownStreamer, render } from "markdansi";

const streamer = createMarkdownStreamer({
  render: (markdown) => render(markdown, { width: process.stdout.columns ?? 80 }),
  spacing: "single",
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => process.stdout.write(streamer.push(chunk)));
process.stdin.on("end", () => process.stdout.write(streamer.finish()));
```

This mode is intended for append-only output such as streamed model responses and terminal logs.

## Customize rendering

Built-in themes are `default`, `dim`, `bright`, `solarized`, `monochrome`, and `contrast`. A custom theme can set named, hex, or ANSI-256 foreground and background colors.

| Area            | Main options                                                                  |
| --------------- | ----------------------------------------------------------------------------- |
| Layout          | `width`, `wrap`, `listIndent`, `quotePrefix`                                  |
| Color and links | `color`, `hyperlinks`, `theme`                                                |
| Tables          | `tableBorder`, `tablePadding`, `tableDense`, `tableTruncate`, `tableEllipsis` |
| Code blocks     | `codeBox`, `codeGutter`, `codeWrap`, `highlighter`                            |

Markdansi does not bundle a syntax highlighter. Pass a `highlighter(code, language)` hook when you need one; see [Syntax highlighting](docs/syntax-highlighting.md) for a Shiki integration.

## CLI and behavior reference

The CLI accepts Markdown from a positional file, `--in`, or stdin, and writes to stdout unless `--out` is set. See the [CLI reference](docs/cli.md) for every flag and the [library reference](docs/library.md) for exports, options, rendering behavior, and edge cases.

## Related

Looking for a native Swift implementation? See [Swiftdansi](https://github.com/steipete/Swiftdansi).

## Development

The build runs formatting, linting, type checking, tests, and compilation:

```sh
pnpm install --frozen-lockfile
pnpm build
```

## License

[MIT](LICENSE)
