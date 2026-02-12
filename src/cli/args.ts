import { CliUsageError } from './errors.js';

export type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn';

export interface CliOptions {
  help: boolean;
  version: boolean;
  yes: boolean;
  skipInstall: boolean;
  skipGit: boolean;
  projectName?: string;
  packageManager?: PackageManager;
  templateRef?: string;
}

const VALID_PACKAGE_MANAGERS = new Set<PackageManager>(['bun', 'npm', 'pnpm', 'yarn']);

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    version: false,
    yes: false,
    skipInstall: false,
    skipGit: false,
  };

  let nextValueFor: '--pm' | '--template-ref' | undefined;

  for (const arg of argv) {
    if (nextValueFor) {
      assignFlagValue(options, nextValueFor, arg);
      nextValueFor = undefined;
      continue;
    }

    if (arg === '--yes' || arg === '-y') {
      options.yes = true;
      continue;
    }

    if (arg === '--skip-install') {
      options.skipInstall = true;
      continue;
    }

    if (arg === '--skip-git') {
      options.skipGit = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      options.version = true;
      continue;
    }

    if (arg === '--pm' || arg === '--template-ref') {
      nextValueFor = arg;
      continue;
    }

    if (arg.startsWith('--pm=')) {
      assignPackageManager(options, arg.slice('--pm='.length));
      continue;
    }

    if (arg.startsWith('--template-ref=')) {
      options.templateRef = parseRequiredValue('--template-ref', arg.slice('--template-ref='.length));
      continue;
    }

    if (arg.startsWith('-')) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    }

    if (options.projectName) {
      throw new CliUsageError('Only one project name may be provided.');
    }

    options.projectName = arg;
  }

  if (nextValueFor) {
    throw new CliUsageError(`Missing value for ${nextValueFor}`);
  }

  return options;
}

function assignFlagValue(options: CliOptions, flag: '--pm' | '--template-ref', value: string): void {
  const nextValue = parseRequiredValue(flag, value);

  if (flag === '--pm') {
    assignPackageManager(options, nextValue);
    return;
  }

  options.templateRef = nextValue;
}

function assignPackageManager(options: CliOptions, value: string): void {
  if (!VALID_PACKAGE_MANAGERS.has(value as PackageManager)) {
    throw new CliUsageError(`Unsupported package manager: ${value}`);
  }

  options.packageManager = value as PackageManager;
}

function parseRequiredValue(flag: string, value: string): string {
  if (!value.trim()) {
    throw new CliUsageError(`Missing value for ${flag}`);
  }

  return value;
}
