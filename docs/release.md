# Release checklist (Markdansi)

Lightweight npm/CLI library; no binaries to sign. Borrowed the changelog discipline from CodexBar, adjusted for npm.

## Prereqs
- Node 22+ and pnpm installed.
- `npm whoami` works and you’re logged in as the publisher.

## Bump & changelog
- Update `package.json` version (no gaps; strictly increment).
- Update `CHANGELOG.md`:
  - Single top-level title, versions in descending order, no duplicates or skipped numbers.
  - User-facing bullets only (features/fixes/behavior changes); avoid internal-only script bumps.
  - Keep bullets concise, one `-` per line; blank line between version sections.
- Make sure README/spec match the new version or new flags.

## Test & build
- `pnpm lint`
- `pnpm test`
- `pnpm types && pnpm compile`

## Tag & publish
- Commit all changes.
- `git tag v<version>`
- `git push && git push --tags`
- Dry-run publish if desired: `npm publish --dry-run`
- Publish: `npm publish`

## Release notes
- When creating the GitHub release:
  - Title: `Markdansi <version>`
  - Paste the matching `CHANGELOG` section as a Markdown bullet list.
  - Visually confirm bullets render correctly (no stray blank lines mid-list).

## Post-publish
- `npm view markdansi version` to confirm.
- Install test: `pnpm dlx markdansi --help` (or `npx markdansi --help`) to verify the new binary works.
- If the CLI changed, run a quick render against a sample file to confirm defaults: `pnpm markdansi -- --in README.md --no-wrap`.
