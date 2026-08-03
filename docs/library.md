# Library reference

Markdansi is an ESM package for Node.js 22 and newer. Its main entry point exports `render`, `createRenderer`, `strip`, `createMarkdownStreamer`, and `themes`, along with the TypeScript types `RenderOptions`, `Theme`, and `ThemeName`.

CommonJS code can load the package asynchronously:

```js
void import("markdansi").then(({ render }) => {
  console.log(render("# Hello"));
});
```

## Rendering functions

`render(markdown, options)` renders one Markdown string. `createRenderer(options)` binds options and returns a reusable render function. `strip(markdown, options)` preserves layout and wrapping while disabling ANSI styles and OSC-8 links.

## Render options

| Option          | Type and default                         | Effect                                                   |
| --------------- | ---------------------------------------- | -------------------------------------------------------- |
| `wrap`          | `boolean`, `true`                        | Enable hard wrapping.                                    |
| `width`         | `number`, terminal width or 80           | Set the target width while wrapping is enabled.          |
| `color`         | `boolean`, TTY-dependent                 | Enable ANSI styling. `false` also disables OSC-8 output. |
| `hyperlinks`    | `boolean`, auto-detected                 | Enable OSC-8 hyperlinks.                                 |
| `theme`         | theme name or `Theme`, `default`         | Select a built-in or custom theme.                       |
| `listIndent`    | `number`, `2`                            | Set spaces per nested list level.                        |
| `quotePrefix`   | `string`, `│ `                           | Set the prefix for blockquote lines.                     |
| `tableBorder`   | `unicode`, `ascii`, or `none`; `unicode` | Select the table border style.                           |
| `tablePadding`  | `number`, `1`                            | Set padding on each side of cell content.                |
| `tableDense`    | `boolean`, `false`                       | Reduce separator rows.                                   |
| `tableTruncate` | `boolean`, `true`                        | Truncate cells to their calculated width.                |
| `tableEllipsis` | `string`, `…`                            | Set the truncation marker.                               |
| `codeBox`       | `boolean`, `true`                        | Draw a box around fenced code.                           |
| `codeGutter`    | `boolean`, `false`                       | Show one-based code line numbers.                        |
| `codeWrap`      | `boolean`, `true`                        | Wrap code lines to the available width.                  |
| `highlighter`   | function                                 | Transform fenced-code text before Markdansi lays it out. |

The built-in theme names are `default`, `dim`, `bright`, `solarized`, `monochrome`, and `contrast`. Theme entries accept named colors, `#rrggbb` colors, numeric ANSI-256 colors, and style flags.

## Rendering behavior

- GitHub Flavored Markdown covers headings, paragraphs, blockquotes, fenced and indented code, tables, ordered and unordered lists, task lists, links, autolinks, emphasis, strong text, and strikethrough.
- Tables use Unicode borders by default, honor GFM alignment, and shrink or truncate cells to fit the render width where possible.
- Fenced code uses a box by default, displays a language label when present, and can wrap or show a line-number gutter.
- Links use OSC-8 when enabled and supported. Without hyperlinks, inline links render as `label (URL)` and autolinks render as the URL.
- `wrap: false` disables hard wrapping and causes `width` to be ignored.
- Reference definitions with indented title continuations are kept together instead of becoming boxed code.

Markdansi does not render images, footnotes, or math, and it does not interpret raw HTML or bundle a syntax highlighter.

## Streaming

`createMarkdownStreamer(options)` accepts appended Markdown chunks through `push()` and flushes remaining content through `finish()`. `reset()` clears its state for reuse.

The only streaming mode is `hybrid`. It emits complete ordinary lines immediately, buffers fenced code until its closing fence, and buffers tables until the table ends. The `spacing` option accepts `preserve`, `single` (the default), or `tight`.

The supplied `render(markdown)` callback must return a self-contained fragment without relying on prior terminal state. Streaming output is append-only and does not move the cursor.
