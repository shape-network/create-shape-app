# Builder Kit Quickstart (CLI)

Use this snippet in the `shape-network/builder-kit` README quickstart:

```bash
bun create shape-app my-app --yes
cd my-app
bun run type-check
bun run lint
bun run contracts:compile
```

Notes:
- `create-shape-app` scaffolds from the latest Builder Kit release tag.
- `--template-ref <tag>` can pin a specific release tag.
