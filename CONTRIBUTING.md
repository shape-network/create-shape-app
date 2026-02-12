# Contributing

Thanks for contributing to `create-shape-app`.

## Requirements
- Node `>=20.18.0`
- Bun `1.3.6+`

## Setup
```bash
bun install
```

## Development Workflow
1. Create a branch from `main`.
2. Make focused changes.
3. Run validation:
   ```bash
   bun run lint
   bun run type-check
   bun run test
   ```
4. Open a pull request with:
   - intent
   - key changes
   - validation commands run

## Commit Style
Use conventional commit format:
- `feat(scope): summary`
- `fix(scope): summary`
- `docs(scope): summary`
- `test(scope): summary`
- `ci(scope): summary`

## Local Smoke Check
```bash
node ./bin/create-shape-app.js my-app --yes --skip-git
```
