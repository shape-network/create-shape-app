# Plan

Build and launch a dedicated `create-shape-app` CLI in its own repository that scaffolds the Builder Kit template only. The CLI will always scaffold from a pinned latest **release tag** (never `main`) to ensure reproducible output and avoid template drift.

## Scope
- In:
  - New standalone repo for `create-shape-app`
  - One template only: current Builder Kit
  - Template retrieval from latest release tag
  - Interactive + non-interactive CLI flow
  - Install, git init, and smoke-test automation
- Out:
  - Multi-template catalog
  - Extension/plugin system
  - Canary/main-branch template sourcing

## Impact-Ordered Priorities
- P0:
  - Reproducible scaffolding from release tags only
  - Safe project creation (name/path validation, non-empty dir protection)
  - Reliable install and git initialization flow
- P1:
  - Polished DX (`bun create` primary path, prompts + flags)
  - CI smoke coverage for generated apps
- P2:
  - Release automation and versioning discipline
  - Better error messaging and troubleshooting
- P3:
  - Optional telemetry (opt-in), docs polish, demo assets

## Action Items
- [x] **Phase 1 — Repository Bootstrap (P0):** Completed in dedicated repo `shape-network/create-shape-app` with TypeScript CLI foundation (`bin`, `src`, tests, lint/typecheck, CI/release workflow scaffolding).
- [x] **Phase 2 — Core Scaffolder (P0):** Implemented command flow with required flags: `--yes`, `--pm`, `--skip-install`, `--skip-git`, positional project name, interactive project-name prompt, and confirmation gating.
- [x] **Phase 3 — Release-Tag Template Fetch (P0):** Implemented release resolution from GitHub Releases (`latest` or `--template-ref <tag>`), strict tag validation (semver tag-only; reject canary), tarball materialization, and safe template copy into target directory.
- [x] **Phase 4 — Post-Scaffold Setup (P0/P1):** Applied project-name substitution (`package.json` name), `.env.example` -> `.env` defaults, dependency install via selected package manager, and optional git init + first commit.
- [ ] **Phase 5 — Validation & CI (P1):** Add integration smoke tests that generate into temp dirs and verify install + key commands complete.
- [ ] **Phase 6 — Publishing & Rollout (P1/P2):** Configure package publishing and release workflow; publish under `create-shape-app`; update Builder Kit docs to point to CLI usage.

## Plan Sync Notes
- February 11, 2026: Created private repo `shape-network/create-shape-app` and pushed `main` with atomic commits (`20b440d`, `f8641ce`, `059a605`, `1bcf1b6`).
- February 11, 2026: Moved local working copy out of monorepo to `/Users/wh/code/pattern-engine/create-shape-app`.
- February 11, 2026: Completed Phase 2 core CLI flow in `src/index.ts` with interactive/non-interactive handling and added behavior tests in `test/cli.test.mjs`.
- February 11, 2026: Standardized local development/validation workflow on Bun (no npm commands).
- February 11, 2026: Completed Phase 3 release-tag template fetch/copy path in `src/template/*` and integrated into `runCLI`.
- February 11, 2026: Completed Phase 4 post-scaffold setup in `src/scaffold/post-setup.ts` and wired it into `runCLI`.
- Next implementation target: **Phase 5 — Validation & CI (P1)**.

## Validation
- `bun create shape-app my-app --yes --skip-install --skip-git`
- In generated app:
  - `bun install`
  - `bun run type-check`
  - `bun run lint`
  - `bun run contracts:compile`

## Rollout
- Publish `v0.1.0` with Builder Kit parity and stable release-tag sourcing.
- Update Builder Kit README quickstart to default to `create-shape-app`.
- Announce with migration note: direct cloning remains optional, CLI is recommended path.

## Risks
- Latest release tag API lookup may fail or be rate-limited:
  - Mitigation: retry + clear error with manual override fallback (`--template-ref <tag>`), still tag-only validated.
- Template/CLI contract drift over time:
  - Mitigation: compatibility check against expected template metadata/version before scaffold.
- Package-manager edge cases across environments:
  - Mitigation: detect invoked PM, support explicit `--pm`, and provide deterministic fallback.

## Open Questions
- None currently; requirements are locked:
  - Dedicated `create-shape-app` repo
  - Single Builder Kit template
  - Latest release tag only
