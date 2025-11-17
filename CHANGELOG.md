# Changelog

## 0.1.1 (2025-11-17)

### Highlights
- Prettier defaults: tables truncate to fit with `…`, code blocks wrap to width, and unicode table borders remain on by default.
- Default theme brightened (cyan inline code, green block code, yellow table headers).
- Code block wrapping now respects width when enabled and keeps gutters aligned.
- Added built-in themes `solarized`, `monochrome`, `contrast`; theme export remains frozen map.
- Migrated source/tests to TypeScript; package is ESM (NodeNext). `prepare` runs full compile to `dist/`.
- Added CLI flags for table/code options; expanded tests for tables/code/gutter/theme defaults.
- Docs/spec/README updated; publish as `markdansi@0.1.1` on npm.

## 0.1.2 (unreleased)

### Planned
- TBD

## 0.1.0 (2025-11-16)

### Highlights
- Markdown → ANSI renderer with GFM support (tables, task lists, strikethrough).
- OSC‑8 hyperlinks with auto‑detection, fallback to `label (url)` when disabled.
- Inline and block themes (`inlineCode` / `blockCode`) with `code` fallback; exported frozen `themes`.
- Configurable wrapping, list indentation (`listIndent`), and blockquote prefix (`quotePrefix`).
- Table rendering with GFM alignments and width-aware padding.
- Highlighter hook for code blocks (pluggable, no built-in highlighting).
- CLI flags: `--no-wrap`, `--no-color`, `--no-links`, `--width`, `--theme`, `--list-indent`, `--quote-prefix`.
- Strict linting (Biome), high test coverage (~96%), types emitted via `pnpm types`.

### Notes
- Code blocks never hard-wrap; long lines may overflow; `[lang]` label shown when provided.
- `strip()` renders with colors/links disabled but honors wrap/width/layout options.
- Package files include src, dist/index.d.ts, README, LICENSE, docs/spec.
