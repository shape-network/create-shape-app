export const HELP_TEXT = `
create-shape-app - Scaffold Shape Builder Kit apps from release tags

Usage:
  create-shape-app <project-name> [options]

Options:
  -y, --yes                 Skip confirmation prompts
  --pm <bun|npm|pnpm|yarn>  Select package manager
  --skip-install            Skip dependency install step
  --skip-git                Skip git init + initial commit
  --template-ref <tag>      Optional tag override (must still be a release tag)
  -h, --help                Show help
  -v, --version             Show version
`.trim();
