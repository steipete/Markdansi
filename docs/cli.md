# CLI reference

The `markdansi` CLI reads Markdown and writes rendered terminal output.

## Input and output

Pass an input file positionally or with `--in`:

```sh
markdansi README.md
markdansi --in README.md
```

With no input file, Markdansi reads stdin. `--in -` selects stdin explicitly.

```sh
cat README.md | markdansi
```

Output goes to stdout unless `--out` names a file.

```sh
markdansi README.md --out README.ansi
```

## Options

| Option                           | Description                                                               |
| -------------------------------- | ------------------------------------------------------------------------- |
| `-h`, `--help`                   | Show CLI help.                                                            |
| `--in FILE`                      | Read from `FILE`; use `-` for stdin.                                      |
| `--out FILE`                     | Write to `FILE` instead of stdout.                                        |
| `--width N`                      | Set the wrap width; defaults to the terminal width or 80.                 |
| `--no-wrap`                      | Disable hard wrapping.                                                    |
| `--no-color`                     | Disable ANSI styles and OSC-8 links.                                      |
| `--no-links`                     | Disable OSC-8 links.                                                      |
| `--theme NAME`                   | Use `default`, `dim`, `bright`, `solarized`, `monochrome`, or `contrast`. |
| `--list-indent N`                | Set spaces per list nesting level; defaults to 2.                         |
| `--quote-prefix STR`             | Set the blockquote prefix; defaults to `│ `.                              |
| `--table-border STR`             | Use `unicode`, `ascii`, or `none`.                                        |
| `--table-padding N`              | Set spaces around table cell content.                                     |
| `--table-dense`                  | Reduce table separator rows.                                              |
| `--table-truncate[=true\|false]` | Enable or disable cell truncation; defaults to true.                      |
| `--table-ellipsis STR`           | Set the table truncation marker.                                          |
| `--code-wrap[=true\|false]`      | Enable or disable code-line wrapping; defaults to true.                   |
| `--code-box[=true\|false]`       | Enable or disable fenced-code boxes; defaults to true.                    |
| `--code-gutter[=true\|false]`    | Enable or disable code line numbers; defaults to false.                   |

Boolean code options accept a bare flag to enable them. `--table-border` and `--theme` accept either `--option value` or `--option=value`; the remaining value options use the separated form shown above.

## Examples

Render with a fixed width and no terminal control sequences:

```sh
markdansi README.md --width 72 --no-color --no-links
```

Use ASCII table borders and unboxed code:

```sh
markdansi README.md --table-border ascii --code-box=false
```
