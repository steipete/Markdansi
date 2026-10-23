# Releasing Markdansi

The [release workflow](../.github/workflows/release.yml) publishes `markdansi` through the shared `openclaw/release-workflows` npm archetype pinned at `@v1`. GitHub Actions owns npm publication and the GitHub Release; npm trusts this repository's **`release.yml`** caller through GitHub OIDC. No npm token or local publishing command is needed.

## Prepare and prove

1. Protect `main`, then prepare the package version and exactly one dated `##` section in `CHANGELOG.md` in a pull request. Keep an `Unreleased` section for subsequent work. Keep the pinned pnpm version aligned with `package.json`.
2. Run `pnpm lint && pnpm typecheck && pnpm test` and `pnpm compile`, merge the reviewed preparation, and wait for successful push CI on the exact merged commit.
3. Dispatch **Release** on current `main` with the package version and **`dry_run: true`** (the default). This must validate and build that exact main commit, pack the package, and install and smoke-test the frozen tarball on clean x64 and arm64 Linux runners. It creates no tags, npm versions, or GitHub Releases. Existing version tags remain untouched.

The shared archetype must include its protected-main dry-run fix: earlier `@v1` revisions selected an existing version tag instead of main. A successful run must identify the merged main SHA as its frozen source. Never treat a proof of an older tag as proof of the preparation commit.

## Publish after approval

After an explicit release request, push a signed annotated `vX.Y.Z` tag at the prepared commit. The workflow verifies SSH signatures against [release-allowed-signers](../.github/release-allowed-signers). Alternatively, dispatch **Release** from protected main with the prepared version and `dry_run: false`; this creates an immutable annotated tag after validation. Dispatch publication does not create an SSH signature; use the signed-tag path when one is required.

The workflow checks package metadata, dated notes, protected-branch ancestry, and independent push CI on the exact frozen commit. It packs without publishing credentials, independently verifies and smoke-tests the same tarball on both architectures, then publishes the verified bytes using npm trusted publishing and verifies registry integrity, signatures, and commit-bound provenance. The GitHub Release contains the changelog notes, tarball, package plan, inventory, and `SHA256SUMS`.

Never move a version tag, overwrite release assets, or republish a version. A retry can only accept an already published npm version when the registry bytes match the frozen payload exactly. Use the immutable tag ref for a live retry; do not try to release an old version from newer main.

## Verify and close out

Read `npm view markdansi@X.Y.Z version dist-tags dist.tarball dist.integrity time --json` and the matching GitHub Release. Verify the release checksums and successful provenance job, and keep the next `Unreleased` section ready. These read-only checks and local build/pack inspection remain available; the former local npm/GitHub publication checklist is retired.

This package has no Homebrew formula, signed macOS artifacts, or Sparkle feed. No repository release secrets are required. Trusted publishing must list `markdansi` → `steipete/Markdansi` → `release.yml` with publishing allowed.

New releases use the shared `SHA256SUMS` inventory instead of the former per-tarball `.sha1` and `.sha256` sidecars. Historical release assets remain unchanged.

## Release log

| Version | Date (UTC) | Actions                                                                                                                                                       | Notes                                                                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.3.7   | 2026-10-23 | Release-prep PR, signed `v0.3.7` tag, and GitHub Actions dry run/publication through the shared npm release workflow.                                         | Restore OSC progress controls and fix streamed fenced-code closing ([changelog](../CHANGELOG.md#037-2026-10-23)).                                     |
| 0.3.6   | 2026-10-21 | Release-prep PR, signed `v0.3.6` tag, and GitHub Actions dry run/publication through the shared npm release workflow.                                         | Fix CJK wrapping while preserving terminal formatting; refresh dependencies and development tools ([changelog](../CHANGELOG.md#036-2026-10-21)).      |
| 0.3.5   | 2026-10-11 | Release-prep PR, `pnpm build`, `pnpm types`, signed `git tag v0.3.5`, npm publish, GitHub release with registry tarball and checksums.                        | Fix streaming, nested lists, and wrapping; remove a high-severity development dependency vulnerability ([changelog](../CHANGELOG.md#035-2026-10-11)). |
| 0.3.4   | 2026-09-14 | `pnpm build`, `pnpm types`, `git tag v0.3.4`, `npm publish`, `gh release create v0.3.4`                                                                       | Update Marked parser and development tools ([changelog](../CHANGELOG.md#034-2026-09-13)).                                                             |
| 0.3.2   | 2026-07-01 | `pnpm build`, `pnpm types`, `npm publish`, `git tag v0.3.2`, `git push --tags`, `gh release create v0.3.2`                                                    | Apply documented CLI rendering flags and add strict argument validation.                                                                              |
| 0.3.1   | 2026-06-11 | `pnpm build`, `npm publish`, `git tag v0.3.1`, `git push --tags`, `gh release create v0.3.1`                                                                  | Replace the unified/micromark parser graph with Marked and reduce the installed dependency graph.                                                     |
| 0.3.0   | 2026-06-10 | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `npm publish`, `git tag v0.3.0`, `git push --tags`, `gh release create v0.3.0` | Positional CLI input plus ANSI/OSC-safe table truncation.                                                                                             |
| 0.2.0   | 2025-12-26 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.2.0`, `git push --tags`, `gh release create v0.2.0`                        | Hybrid streaming + remove live renderer.                                                                                                              |
| 0.1.7   | 2025-12-19 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.7`, `git push --tags`, `gh release create v0.1.7`                        | Avoid orphaned trailing articles/prepositions when wrapping.                                                                                          |
| 0.1.6   | 2025-12-19 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.6`, `git push --tags`, `gh release create v0.1.6`                        | Collapse soft line breaks in paragraphs/lists; preserve hard breaks; more tests.                                                                      |
| 0.1.5   | 2025-12-18 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.5`, `git push --tags`, `gh release create v0.1.5`                        | Live in-place renderer (`createLiveRenderer`) + row-aware redraw + more tests (removed in 0.2.0).                                                     |
| 0.1.4   | 2025-12-18 | `pnpm lint`, `pnpm test`, `pnpm types`, `pnpm compile`, `npm publish`, `git tag v0.1.4`, `git push --tags`, `gh release create v0.1.4`                        | Export fallback for TSX/CJS resolution (`default`), plus docs note.                                                                                   |
| 0.1.3   | 2025-11-18 | `pnpm lint`, `pnpm test`, `pnpm compile`, `npm publish`, `git tag v0.1.3`, `git push --tags`                                                                  | Parser normalization: merge code-only lists, auto-tag diffs, unbox single-line code.                                                                  |
