# create-shape-app

CLI for scaffolding Shape apps from the Builder Kit template pinned to release tags.

## Status

Phase 1 bootstrap is complete:
- TypeScript CLI foundation (`bin`, `src`)
- CLI argument parser with tests
- lint/type-check/test/build scripts
- release workflow scaffold

## Local Development

```bash
bun install
bun run lint
bun run type-check
bun run test
```

## Planned Command

```bash
create-shape-app <project-name> --yes --skip-install --skip-git
```

Core scaffolding behavior is implemented in later phases.
