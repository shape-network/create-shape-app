# create-shape-app

CLI for scaffolding Shape apps from the Builder Kit template pinned to release tags.

## Status

Current release target: `v0.1.1`.

Implemented:
- Release-tag-only template sourcing from `shape-network/builder-kit`
- Core scaffolding flow with prompts + flags
- Post-scaffold setup (`package.json` name, `.env` defaults, install, optional git init/commit)
- Smoke validation test and Bun-based CI/release checks

## Local Development

```bash
bun install
bun run lint
bun run type-check
bun run test
```

## Planned Command

```bash
bun create shape-app my-app --yes
```

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

## Publish

- Trigger: GitHub release publish event.
- Guard: workflow checks release tag matches `package.json` version.
- Publish target: npm package `create-shape-app`.

## Builder Kit Rollout

Builder Kit README quickstart update snippet is tracked in:
- `/Users/wh/code/pattern-engine/create-shape-app/docs/builder-kit-quickstart.md`
