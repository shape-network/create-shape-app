import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawn } from 'node:child_process';
import type { TemplateRelease } from './release.js';

export interface MaterializedTemplate {
  templateRoot: string;
  cleanup: () => Promise<void>;
}

export async function materializeTemplateFromRelease(
  release: TemplateRelease,
  fetchImpl: typeof fetch = fetch,
): Promise<MaterializedTemplate> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'create-shape-app-'));
  const tarballPath = join(tempRoot, 'template.tar.gz');
  const extractedPath = join(tempRoot, 'extracted');

  try {
    await downloadTarball(release.tarballUrl, tarballPath, fetchImpl);
    await mkdir(extractedPath, { recursive: true });
    await extractTarball(tarballPath, extractedPath);

    const templateRoot = await findArchiveRootDirectory(extractedPath);

    return {
      templateRoot,
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function downloadTarball(url: string, outputPath: string, fetchImpl: typeof fetch): Promise<void> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'create-shape-app',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download template tarball: HTTP ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, data);
}

async function extractTarball(tarballPath: string, outputDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', tarballPath, '-C', outputDir], {
      stdio: 'ignore',
    });

    child.once('error', (error) => {
      reject(new Error(`Failed to run tar: ${error.message}`));
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`tar extraction failed with exit code ${String(code)}`));
    });
  });
}

async function findArchiveRootDirectory(extractedPath: string): Promise<string> {
  const entries = await readdir(extractedPath, { withFileTypes: true });
  const rootDirectory = entries.find((entry) => entry.isDirectory());

  if (!rootDirectory) {
    throw new Error('Template archive did not contain a root directory.');
  }

  return join(extractedPath, basename(rootDirectory.name));
}
