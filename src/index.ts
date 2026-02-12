import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from 'node:readline';
import { parseArgs, type PackageManager } from './cli/args.js';
import { CliUsageError } from './cli/errors.js';
import { HELP_TEXT } from './cli/help.js';
import {
  runPostScaffoldSetup,
  type PostScaffoldSetupOptions,
  type PostScaffoldSetupResult,
} from './scaffold/post-setup.js';
import { materializeTemplateFromRelease, type MaterializedTemplate } from './template/materialize.js';
import { copyTemplateToDirectory, prepareTargetDirectory } from './template/project.js';
import { fetchTemplateRelease, type TemplateRelease } from './template/release.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version?: string };
export const CLI_VERSION = packageJson.version ?? '0.0.0';
const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

interface CliRuntime {
  env: NodeJS.ProcessEnv;
  cwd: string;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  print: (message: string) => void;
  printError: (message: string) => void;
  prompt: (message: string) => Promise<string>;
  selectPackageManager: (options: PackageManagerSelectOptions) => Promise<PackageManager | undefined>;
  confirm: (message: string) => Promise<boolean>;
  resolveTemplateRelease: (templateRef?: string) => Promise<TemplateRelease>;
  materializeTemplate: (release: TemplateRelease) => Promise<MaterializedTemplate>;
  prepareTargetDirectory: (targetDirectory: string) => Promise<void>;
  copyTemplateToDirectory: (templateRoot: string, targetDirectory: string) => Promise<void>;
  runPostScaffoldSetup: (options: PostScaffoldSetupOptions) => Promise<PostScaffoldSetupResult>;
}

const DEFAULT_PROJECT_NAME_PROMPT = 'Project name: ';
const DEFAULT_CONFIRM_PROMPT = 'Continue? (Y/n): ';
const PACKAGE_MANAGER_SELECT_MESSAGE = 'Package manager:';

interface PackageManagerSelectOptions {
  message: string;
  choices: readonly PackageManager[];
  defaultValue: PackageManager;
}

export async function runCLI(argv: string[], runtimeOverrides: Partial<CliRuntime> = {}): Promise<number> {
  const runtime = createRuntime(runtimeOverrides);

  try {
    const options = parseArgs(argv);

    if (options.help) {
      runtime.print(HELP_TEXT);
      return 0;
    }

    if (options.version) {
      runtime.print(CLI_VERSION);
      return 0;
    }

    const projectName = await resolveProjectName(options.projectName, runtime);
    if (!projectName) {
      runtime.printError('Missing required project name.');
      runtime.printError('');
      runtime.printError(HELP_TEXT);
      return 1;
    }

    assertValidProjectName(projectName);

    const packageManager = await resolvePackageManager(options.packageManager, options.yes, runtime);
    const targetDirectory = path.resolve(runtime.cwd, projectName);

    if (!options.yes) {
      if (!isInteractive(runtime)) {
        runtime.printError('Interactive confirmation is unavailable in non-interactive mode.');
        runtime.printError('Re-run with --yes to proceed.');
        return 1;
      }

      runtime.print('');
      runtime.print('Scaffold request');
      runtime.print(`  project: ${projectName}`);
      runtime.print(`  target directory: ${targetDirectory}`);
      runtime.print(`  package manager: ${packageManager}`);
      runtime.print(`  skip install: ${formatBool(options.skipInstall)}`);
      runtime.print(`  skip git: ${formatBool(options.skipGit)}`);
      runtime.print(`  template ref: ${options.templateRef ?? 'latest release tag'}`);
      runtime.print('');

      const shouldContinue = await runtime.confirm(DEFAULT_CONFIRM_PROMPT);
      if (!shouldContinue) {
        runtime.printError('Aborted.');
        return 1;
      }
    }

    const release = await runtime.resolveTemplateRelease(options.templateRef);
    runtime.print(`Using Builder Kit release ${release.tag}`);

    const materializedTemplate = await runtime.materializeTemplate(release);

    try {
      await runtime.prepareTargetDirectory(targetDirectory);
      await runtime.copyTemplateToDirectory(materializedTemplate.templateRoot, targetDirectory);
    } finally {
      await materializedTemplate.cleanup();
    }

    const setupResult = await runtime.runPostScaffoldSetup({
      targetDirectory,
      projectName,
      packageManager,
      skipInstall: options.skipInstall,
      skipGit: options.skipGit,
    });

    runtime.print(`Scaffolded ${projectName} from builder-kit@${release.tag}.`);
    runtime.print(`Dependencies: ${options.skipInstall ? 'skipped' : `installed via ${packageManager}`}`);
    if (setupResult.gitStatus === 'initialized') {
      runtime.print('Git setup: initialized with initial commit');
    } else if (setupResult.gitStatus === 'skipped') {
      runtime.print('Git setup: skipped');
    } else {
      runtime.print('Git setup: skipped due to git initialization failure');
      runtime.printError(`Warning: ${setupResult.gitFailureMessage ?? 'Unable to initialize git repository.'}`);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    runtime.printError(message);
    if (error instanceof CliUsageError) {
      runtime.printError('');
      runtime.printError(HELP_TEXT);
    }
    return 1;
  }
}

function createRuntime(overrides: Partial<CliRuntime>): CliRuntime {
  const env = process.env;

  return {
    env,
    cwd: process.cwd(),
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    print: console.log,
    printError: console.error,
    prompt: defaultPrompt,
    selectPackageManager: defaultSelectPackageManager,
    confirm: defaultConfirm,
    resolveTemplateRelease: (templateRef) =>
      fetchTemplateRelease({
        templateRef,
        githubToken: env.GITHUB_TOKEN,
      }),
    materializeTemplate: materializeTemplateFromRelease,
    prepareTargetDirectory,
    copyTemplateToDirectory,
    runPostScaffoldSetup,
    ...overrides,
  };
}

async function resolveProjectName(projectName: string | undefined, runtime: CliRuntime): Promise<string | undefined> {
  if (projectName) {
    return projectName.trim();
  }

  if (!isInteractive(runtime)) {
    return undefined;
  }

  const answer = await runtime.prompt(DEFAULT_PROJECT_NAME_PROMPT);
  const nextProjectName = answer.trim();
  return nextProjectName || undefined;
}

async function resolvePackageManager(
  packageManager: PackageManager | undefined,
  skipPrompts: boolean,
  runtime: CliRuntime,
): Promise<PackageManager> {
  if (packageManager) {
    return packageManager;
  }

  const detectedPackageManager = detectPackageManager(runtime.env.npm_config_user_agent);
  if (!isInteractive(runtime) || skipPrompts) {
    return detectedPackageManager;
  }

  return (
    (await runtime.selectPackageManager({
      message: PACKAGE_MANAGER_SELECT_MESSAGE,
      choices: PACKAGE_MANAGERS,
      defaultValue: detectedPackageManager,
    })) ?? detectedPackageManager
  );
}

function isInteractive(runtime: CliRuntime): boolean {
  return runtime.stdinIsTTY && runtime.stdoutIsTTY;
}

async function defaultPrompt(message: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await rl.question(message);
  } finally {
    rl.close();
  }
}

async function defaultConfirm(message: string): Promise<boolean> {
  const answer = await defaultPrompt(message);
  const normalized = answer.trim().toLowerCase();
  return normalized === '' || normalized === 'y' || normalized === 'yes';
}

async function defaultSelectPackageManager(options: PackageManagerSelectOptions): Promise<PackageManager | undefined> {
  const { message, choices, defaultValue } = options;
  if (choices.length === 0) {
    return undefined;
  }

  const defaultIndex = choices.indexOf(defaultValue);
  let selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return choices[selectedIndex];
  }

  const stdin = process.stdin;
  const stdout = process.stdout;
  const previousRawMode = Boolean(stdin.isRaw);
  let renderedLines = 0;

  const render = () => {
    const lines = [
      message,
      ...choices.map((candidate, index) => {
        const indicator = index === selectedIndex ? '>' : ' ';
        const defaultLabel = candidate === defaultValue ? ' (default)' : '';
        return ` ${indicator} ${candidate}${defaultLabel}`;
      }),
      '  Use Up/Down arrows and Enter to confirm.',
    ];

    if (renderedLines > 0) {
      moveCursor(stdout, 0, -renderedLines);
      cursorTo(stdout, 0);
      clearScreenDown(stdout);
    }

    stdout.write(lines.join('\n'));
    stdout.write('\n');
    renderedLines = lines.length;
  };

  emitKeypressEvents(stdin);
  if (typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdout.write('\x1b[?25l');
  render();

  try {
    const selected = await new Promise<PackageManager>((resolve, reject) => {
      const onKeypress = (_value: string, key: { ctrl?: boolean; name?: string }) => {
        if (!key) {
          return;
        }

        if (key.ctrl && key.name === 'c') {
          stdin.off('keypress', onKeypress);
          reject(new Error('Aborted.'));
          return;
        }

        if (key.name === 'up' || key.name === 'k') {
          selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
          render();
          return;
        }

        if (key.name === 'down' || key.name === 'j') {
          selectedIndex = (selectedIndex + 1) % choices.length;
          render();
          return;
        }

        if (key.name === 'return' || key.name === 'enter') {
          stdin.off('keypress', onKeypress);
          resolve(choices[selectedIndex]);
          return;
        }

        if (key.name === 'escape') {
          stdin.off('keypress', onKeypress);
          resolve(defaultValue);
        }
      };

      stdin.on('keypress', onKeypress);
    });

    if (renderedLines > 0) {
      moveCursor(stdout, 0, -renderedLines);
      cursorTo(stdout, 0);
      clearScreenDown(stdout);
    }
    stdout.write(`Package manager: ${selected}\n`);
    return selected;
  } finally {
    stdout.write('\x1b[?25h');
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(previousRawMode);
    }
  }
}

function assertValidProjectName(projectName: string): void {
  if (projectName === '.' || projectName === '..') {
    throw new CliUsageError('Invalid project name: "." and ".." are not allowed.');
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    throw new CliUsageError(
      'Invalid project name: use only letters, numbers, ".", "-", or "_" and no path separators.',
    );
  }
}

function detectPackageManager(userAgent: string | undefined): PackageManager {
  if (typeof userAgent === 'string') {
    if (userAgent.startsWith('pnpm/')) {
      return 'pnpm';
    }

    if (userAgent.startsWith('yarn/')) {
      return 'yarn';
    }

    if (userAgent.startsWith('bun/')) {
      return 'bun';
    }
  }

  return 'npm';
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await runCLI(process.argv.slice(2));
  process.exit(code);
}
