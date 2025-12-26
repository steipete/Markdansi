# Releasing Markdansi

This merges the checklist and the running release log into one file for convenience.

## Checklist
- Node 22+ and pnpm installed; `npm whoami` logged in as publisher.
- Bump version in `package.json`.
- Update `CHANGELOG.md` (descending order, concise bullets, blank lines between versions, no duplicates).
- Keep README/spec in sync if flags or behavior changed.
- Tests/build: `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`.
- Commit all changes.
- Tag: `git tag v<version>`.
- Push: `git push && git push --tags`.
- Publish: optional dry-run `npm publish --dry-run`, then `npm publish`.
- GitHub release (required for every tag):
  - Title: `Markdansi <version>`.
  - Body: paste the matching `CHANGELOG` section as bullets.
  - Assets: upload `npm pack` outputs and checksums:
    - Run `npm pack markdansi@<version> --pack-destination /tmp/md-packs`.
    - Upload `markdansi-<version>.tgz`, `markdansi-<version>.tgz.sha1`, `markdansi-<version>.tgz.sha256` via `gh release upload --clobber`.
  - GitHub will also auto-attach `Source code (zip|tar.gz)` for the tag.
- Post-publish/verify:
  - `npm view markdansi version` matches the tag.
  - `gh release view v<version>` shows title + bullet list with no stray `\n`/wrap issues.
  - Confirm assets include `markdansi-<version>.tgz`, `.sha1`, `.sha256`, plus GitHub’s auto “Source code (zip|tar.gz)”.
  - Quick smoke: `pnpm dlx markdansi --help` (or `npx markdansi --help`) and `pnpm markdansi -- --in README.md --no-wrap`.

## Release log

| Version | Date (UTC) | Actions | Notes |
| --- | --- | --- | --- |
| 0.1.7 | 2025-12-19 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.7`, `git push --tags`, `gh release create v0.1.7` | Avoid orphaned trailing articles/prepositions when wrapping. |
| 0.1.6 | 2025-12-19 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.6`, `git push --tags`, `gh release create v0.1.6` | Collapse soft line breaks in paragraphs/lists; preserve hard breaks; more tests. |
| 0.1.5 | 2025-12-18 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.5`, `git push --tags`, `gh release create v0.1.5` | Live in-place renderer (`createLiveRenderer`) + row-aware redraw + more tests (removed in 0.3.0). |
| 0.1.4 | 2025-12-18 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.4`, `git push --tags`, `gh release create v0.1.4` | Export fallback for TSX/CJS resolution (`default`), plus docs note. |
| 0.1.3 | 2025-11-18 | `pnpm lint`, `pnpm test`, `pnpm compile`, `npm publish`, `git tag v0.1.3`, `git push --tags` | Parser normalization: merge code-only lists, auto-tag diffs, unbox single-line code. |
