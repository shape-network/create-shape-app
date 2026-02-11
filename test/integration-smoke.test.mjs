import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCLI } from '../dist/index.js';

test('smoke: scaffold then install and run key app commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-smoke-'));
  const templateRoot = join(root, 'template');
  const targetDirectory = join(root, 'demo-app');
  const commandTmpDir = join(root, '.tmp');

  try {
    await mkdir(templateRoot, { recursive: true });
    await mkdir(commandTmpDir, { recursive: true });

    await writeFile(
      join(templateRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'builder-kit-template',
          version: '0.0.0',
          private: true,
          scripts: {
            'type-check': 'bun --version',
            lint: 'bun --version',
            'contracts:compile': 'bun --version',
          },
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeFile(join(templateRoot, '.env.example'), 'FOO=bar\n', 'utf8');

    const code = await runCLI(['demo-app', '--yes', '--skip-install', '--skip-git', '--pm=bun'], {
      cwd: root,
      resolveTemplateRelease: async () => ({
        tag: 'v9.9.9',
        tarballUrl: 'https://example.com/template.tar.gz',
      }),
      materializeTemplate: async () => ({
        templateRoot,
        cleanup: async () => {},
      }),
      print: () => {},
      printError: () => {},
    });

    assert.equal(code, 0);

    const packageJson = JSON.parse(await readFile(join(targetDirectory, 'package.json'), 'utf8'));
    assert.equal(packageJson.name, 'demo-app');
    assert.equal(await readFile(join(targetDirectory, '.env'), 'utf8'), 'FOO=bar\n');

    await runCommand('bun', ['install'], targetDirectory, { TMPDIR: commandTmpDir });
    await runCommand('bun', ['run', 'type-check'], targetDirectory, { TMPDIR: commandTmpDir });
    await runCommand('bun', ['run', 'lint'], targetDirectory, { TMPDIR: commandTmpDir });
    await runCommand('bun', ['run', 'contracts:compile'], targetDirectory, { TMPDIR: commandTmpDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function runCommand(command, args, cwd, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'ignore',
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.once('error', (error) => {
      reject(error);
    });

    child.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${[command, ...args].join(' ')}`));
    });
  });
}
