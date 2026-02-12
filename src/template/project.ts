import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';

const EXCLUDED_TEMPLATE_ENTRIES = new Set(['.git', '.claude', 'AGENTS.md', 'CLAUDE.md', '.DS_Store']);

export async function prepareTargetDirectory(targetDirectory: string): Promise<void> {
  const directoryExists = await pathExists(targetDirectory);

  if (!directoryExists) {
    await mkdir(targetDirectory, { recursive: true });
    return;
  }

  const metadata = await stat(targetDirectory);
  if (!metadata.isDirectory()) {
    throw new Error(`Target path exists and is not a directory: ${targetDirectory}`);
  }

  const entries = await readdir(targetDirectory);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${targetDirectory}`);
  }
}

export async function copyTemplateToDirectory(templateRoot: string, targetDirectory: string): Promise<void> {
  await cp(templateRoot, targetDirectory, {
    recursive: true,
    force: false,
    filter(sourcePath) {
      return !EXCLUDED_TEMPLATE_ENTRIES.has(basename(sourcePath));
    },
  });
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
