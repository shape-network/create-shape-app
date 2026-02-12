# create-shape-app

CLI for scaffolding Shape apps from the Builder Kit template pinned to release tags.

## Quick Start

```bash
bun create shape-app my-app --yes
cd my-app
bun run type-check
bun run lint
bun run contracts:compile
```

Equivalent commands:
- `npm create shape-app@latest my-app -- --yes`
- `pnpm dlx create-shape-app my-app --yes`
- `yarn create shape-app my-app --yes`

## CLI Usage

```bash
create-shape-app [project-name] [options]
```

Options:
- `-y, --yes`
- `--pm <bun|npm|pnpm|yarn>`
- `--skip-install`
- `--skip-git`
- `--template-ref <tag>`
- `-h, --help`
- `-v, --version`

## Behavior
- Scaffolds from `shape-network/builder-kit` release tags only (`latest` by default).
- Rejects non-release refs (for example `main`) and canary tags.
- In non-interactive terminals, `--yes` is required.
- Copies template files, excluding VCS/internal maintainer metadata.
- Applies defaults:
  - Root `package.json` name is set from the project directory name.
  - `.env.example` is copied to `.env` when present.
  - Dependencies are installed unless `--skip-install` is set.
  - Git is initialized unless `--skip-git` is set.

## Troubleshooting
- GitHub API rate limit during template lookup:
  - retry later, set `GITHUB_TOKEN`, or pass `--template-ref <tag>`.
- Git init or commit failure:
  - scaffold still succeeds; run `git init && git add -A && git commit -m "Initial commit"` manually.
- Dependency install failure:
  - rerun your package manager (`bun install`, `npm install`, `pnpm install`, or `yarn install`) inside generated app.

## Local Development

```bash
bun install
bun run lint
bun run type-check
bun run test
```

Builder Kit README quickstart update snippet is tracked in:
- `docs/builder-kit-quickstart.md`

## Publish
- Trigger: GitHub release publish event.
- Guard: workflow checks release tag matches `package.json` version.
- Requirement: repository secret `NPM_TOKEN` must be configured.
- Publish target: npm package `create-shape-app`.

## Community
- Contribution guide: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`
- Code of conduct: `CODE_OF_CONDUCT.md`
