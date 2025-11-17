# Changelog

## 0.1.2 (unreleased)

### Highlights
- Migrated codebase to TypeScript (NodeNext ESM), compiled output now in `dist/`.
- Package entrypoints/bins point to compiled JS; `prepare` runs full compile.
- Types now come from source; removed separate `types/` shim.
- Added tests for table borders/padding/dense/truncate, code gutters/wrap box toggles, theme colors, and CLI flags.

## 0.1.1 (about to release)

### Highlights
- Prettier defaults: tables truncate to fit with `…`, code blocks wrap to width, and unicode table borders remain on by default.
- Default theme brightened (cyan inline code, green block code, yellow table headers).
- Code block wrapping now respects width when enabled and keeps gutters aligned.
- Docs/spec/README updated; version bump to 0.1.1; published as `markdansi@0.1.1` on npm.

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
