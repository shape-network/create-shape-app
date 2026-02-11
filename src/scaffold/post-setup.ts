import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { PackageManager } from '../cli/args.js';

const INITIAL_COMMIT_MESSAGE = 'Initial commit from create-shape-app';

export interface PostScaffoldSetupOptions {
  targetDirectory: string;
  projectName: string;
  packageManager: PackageManager;
  skipInstall: boolean;
  skipGit: boolean;
}

type CommandRunner = (command: string, args: string[], cwd: string) => Promise<void>;

export async function runPostScaffoldSetup(
  options: PostScaffoldSetupOptions,
  runCommand: CommandRunner = executeCommand,
): Promise<void> {
  await applyProjectDefaults(options.targetDirectory, options.projectName);

  if (!options.skipInstall) {
    const [command, args] = getInstallCommand(options.packageManager);
    await runCommand(command, args, options.targetDirectory);
  }

  if (!options.skipGit) {
    await runCommand('git', ['init'], options.targetDirectory);
    await runCommand('git', ['add', '--all'], options.targetDirectory);
    await runCommand('git', ['commit', '-m', INITIAL_COMMIT_MESSAGE], options.targetDirectory);
  }
}

export function getInstallCommand(packageManager: PackageManager): [string, string[]] {
  if (packageManager === 'bun') {
    return ['bun', ['install']];
  }

  if (packageManager === 'pnpm') {
    return ['pnpm', ['install']];
  }

  if (packageManager === 'yarn') {
    return ['yarn', ['install']];
  }

  return ['npm', ['install']];
}

async function applyProjectDefaults(targetDirectory: string, projectName: string): Promise<void> {
  await applyPackageNameSubstitution(targetDirectory, projectName);
  await applyEnvFileDefaults(targetDirectory);
}

async function applyPackageNameSubstitution(targetDirectory: string, projectName: string): Promise<void> {
  const packageJsonPath = join(targetDirectory, 'package.json');

  if (!(await pathExists(packageJsonPath))) {
    return;
  }

  const raw = await readFile(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  parsed.name = toPackageName(projectName);
  await writeFile(packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

async function applyEnvFileDefaults(targetDirectory: string): Promise<void> {
  const sourcePath = join(targetDirectory, '.env.example');
  const targetPath = join(targetDirectory, '.env');

  if (!(await pathExists(sourcePath)) || (await pathExists(targetPath))) {
    return;
  }

  await copyFile(sourcePath, targetPath);
}

function toPackageName(projectName: string): string {
  const normalized = projectName.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const withoutLeading = normalized.replace(/^[._-]+/, '');

  if (!withoutLeading) {
    throw new Error('Unable to derive package name from project name.');
  }

  return withoutLeading;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function executeCommand(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.once('error', (error) => {
      reject(new Error(`Failed to start command "${command}": ${error.message}`));
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command "${[command, ...args].join(' ')}" failed with exit code ${String(code)}`));
    });
  });
}
