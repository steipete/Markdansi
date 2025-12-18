# Changelog

## 0.1.5 (2025-12-18)

### Highlights
- Add a live in-place renderer (`createLiveRenderer`) that can re-render markdown streams with synchronized output framing.
- Fix live redraw correctness for wrapped lines via row-aware cursor movement.
- Expand test coverage for live rendering edge cases (shrink/clear, cursor hide, newline normalization).

## 0.1.4 (2025-12-18)

### Highlights
- Fix TSX/CommonJS consumers failing to resolve the package export by adding a `default` export condition (issue #1).

## 0.1.3 (2025-11-18)

### Highlights
- Collapse bulletized/fenced lists of code blocks into a single block to avoid per-line boxes in chatty patches.
- Auto-tag unfenced diffs (`diff --git` / `--- a/` / `@@`) and render them as `diff` code blocks without wrapping so alignment stays intact.
- Render single-line code blocks without a surrounding box; multi-line blocks keep boxes.
- Added regression tests for code-list collapsing, diff detection/no-wrap, and single-line unboxed rendering.

## 0.1.2 (2025-11-17)

### Highlights
- Normalize link/reference definitions that spill titles onto indented lines so they render as plain text instead of boxed code (fixes pasted blog footnotes).
- Code box headers now pad with dashes when the label is shorter than the body line length; added regression coverage.
- Added tests covering footnote-style continuations and header padding; ensured docs/README/spec mention the behavior.
- Reference blocks now render with a single blank line before the first definition and no extra blank lines between entries, matching common Markdown viewers.

## 0.1.1 (2025-11-17)

### Highlights
- Prettier defaults: tables truncate to fit with `…`, code blocks wrap to width, and unicode table borders remain on by default.
- Default theme brightened (cyan inline code, green block code, yellow table headers).
- Code block wrapping now respects width when enabled and keeps gutters aligned.
- Added built-in themes `solarized`, `monochrome`, `contrast`; theme export remains frozen map.
- Migrated source/tests to TypeScript; package is ESM (NodeNext). `prepare` runs full compile to `dist/`.
- Added CLI flags for table/code options; expanded tests for tables/code/gutter/theme defaults.
- Docs/spec/README updated; published as `markdansi@0.1.1` on npm.
- Code box header now embeds `[lang]` label in the top border; added tests for long labels, no-label cases, and gutters.

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
