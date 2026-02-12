import path from 'node:path';
import { pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { parseArgs } from './cli/args.js';
import { HELP_TEXT } from './cli/help.js';
import { runPostScaffoldSetup, type PostScaffoldSetupOptions } from './scaffold/post-setup.js';
import { materializeTemplateFromRelease, type MaterializedTemplate } from './template/materialize.js';
import { copyTemplateToDirectory, prepareTargetDirectory } from './template/project.js';
import { fetchTemplateRelease, type TemplateRelease } from './template/release.js';

export const CLI_VERSION = '0.1.1';

interface CliRuntime {
  env: NodeJS.ProcessEnv;
  cwd: string;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  print: (message: string) => void;
  printError: (message: string) => void;
  prompt: (message: string) => Promise<string>;
  confirm: (message: string) => Promise<boolean>;
  resolveTemplateRelease: (templateRef?: string) => Promise<TemplateRelease>;
  materializeTemplate: (release: TemplateRelease) => Promise<MaterializedTemplate>;
  prepareTargetDirectory: (targetDirectory: string) => Promise<void>;
  copyTemplateToDirectory: (templateRoot: string, targetDirectory: string) => Promise<void>;
  runPostScaffoldSetup: (options: PostScaffoldSetupOptions) => Promise<void>;
}

const DEFAULT_PROJECT_NAME_PROMPT = 'Project name: ';
const DEFAULT_CONFIRM_PROMPT = 'Continue? (y/N): ';

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

    const packageManager = options.packageManager ?? detectPackageManager(runtime.env.npm_config_user_agent);
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

    await runtime.runPostScaffoldSetup({
      targetDirectory,
      projectName,
      packageManager,
      skipInstall: options.skipInstall,
      skipGit: options.skipGit,
    });

    runtime.print(`Scaffolded ${projectName} from builder-kit@${release.tag}.`);
    runtime.print(`Dependencies: ${options.skipInstall ? 'skipped' : `installed via ${packageManager}`}`);
    runtime.print(`Git setup: ${options.skipGit ? 'skipped' : 'initialized with initial commit'}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    runtime.printError(message);
    runtime.printError('');
    runtime.printError(HELP_TEXT);
    return 1;
  }
}

function createRuntime(overrides: Partial<CliRuntime>): CliRuntime {
  return {
    env: process.env,
    cwd: process.cwd(),
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    print: console.log,
    printError: console.error,
    prompt: defaultPrompt,
    confirm: defaultConfirm,
    resolveTemplateRelease: (templateRef) => fetchTemplateRelease({ templateRef }),
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

function isInteractive(runtime: CliRuntime): boolean {
  return runtime.stdinIsTTY && runtime.stdoutIsTTY;
}

async function defaultPrompt(message: string): Promise<string> {
  const rl = readline.createInterface({
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
  return /^(y|yes)$/i.test(answer.trim());
}

function assertValidProjectName(projectName: string): void {
  if (projectName === '.' || projectName === '..') {
    throw new Error('Invalid project name: "." and ".." are not allowed.');
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    throw new Error(
      'Invalid project name: use only letters, numbers, ".", "-", or "_" and no path separators.',
    );
  }
}

function detectPackageManager(userAgent: string | undefined): 'bun' | 'npm' | 'pnpm' | 'yarn' {
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
