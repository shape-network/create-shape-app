# create-shape-app

[![npm version](https://img.shields.io/npm/v/create-shape-app)](https://www.npmjs.com/package/create-shape-app)
[![license](https://img.shields.io/npm/l/create-shape-app)](./LICENSE)

CLI for scaffolding [Shape](https://shape.network) apps from the [Builder Kit](https://github.com/shape-network/builder-kit) template.

## Quick Start

```bash
npx create-shape-app my-app
```

Other package managers:

- `bunx create-shape-app my-app`
- `pnpm dlx create-shape-app my-app`
- `yarn create shape-app my-app`

## What You Get

A monorepo with everything needed to build on Shape:

- **`apps/web`** -- Next.js frontend with wagmi, viem, and wallet connection
- **`packages/contract`** -- Hardhat project with a sample contract, deploy scripts, and tests
- Pre-configured for Shape mainnet and Shape Sepolia
- TypeScript throughout, Tailwind CSS styling

## CLI Options

| Flag | Description |
|------|-------------|
| `-y, --yes` | Skip confirmation prompts |
| `--pm <bun\|npm\|pnpm\|yarn>` | Select package manager |
| `--skip-install` | Skip dependency install step |
| `--skip-git` | Skip git init + initial commit |
| `--template-ref <tag>` | Pin to a specific Builder Kit release tag |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

If `project-name` is omitted in an interactive terminal, you will be prompted.
If `--pm` is omitted in an interactive terminal, you can pick a package manager.

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

## Publish

- Trigger: GitHub release publish event.
- Guard: workflow checks release tag matches `package.json` version.
- Requirement: repository secret `NPM_TOKEN` must be configured.
- Publish target: npm package `create-shape-app`.

## Links

- [Shape](https://shape.network)
- [Shape docs](https://docs.shape.network)
- [Builder Kit](https://github.com/shape-network/builder-kit)

## Support 

Questions or feedback? Reach out! 

- [Discord](http://discord.com/invite/shape-l2)
- [@williamhzo on X](https://x.com/williamhzo)
