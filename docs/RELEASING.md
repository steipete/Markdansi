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
- Post-publish: `npm view markdansi version`; quick CLI check `pnpm dlx markdansi --help` (or `npx markdansi --help`); sample render `pnpm markdansi -- --in README.md --no-wrap`.
- Create GitHub release with title `Markdansi <version>` and paste the matching changelog bullets; visually confirm formatting.

## Release log

| Version | Date (UTC) | Actions | Notes |
| --- | --- | --- | --- |
| 0.1.3 | 2025-11-18 | `pnpm lint`, `pnpm test`, `pnpm compile`, `npm publish`, `git tag v0.1.3`, `git push --tags` | Parser normalization: merge code-only lists, auto-tag diffs, unbox single-line code. |
