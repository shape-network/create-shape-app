import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { getInstallCommand, runPostScaffoldSetup } from '../dist/scaffold/post-setup.js';

test('getInstallCommand maps each package manager', () => {
  assert.deepEqual(getInstallCommand('bun'), ['bun', ['install']]);
  assert.deepEqual(getInstallCommand('pnpm'), ['pnpm', ['install']]);
  assert.deepEqual(getInstallCommand('yarn'), ['yarn', ['install']]);
  assert.deepEqual(getInstallCommand('npm'), ['npm', ['install']]);
});

test('runPostScaffoldSetup applies package name and env defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));

  try {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'builder-kit-template', private: true }, null, 2),
      'utf8',
    );
    await writeFile(join(root, '.env.example'), 'API_URL=http://localhost:3000\n', 'utf8');

    const calls = [];
    const result = await runPostScaffoldSetup(
      {
        targetDirectory: root,
        projectName: 'My-App',
        packageManager: 'bun',
        skipInstall: true,
        skipGit: true,
      },
      async (command, args, cwd) => {
        calls.push({ command, args, cwd });
      },
    );

    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const envFile = await readFile(join(root, '.env'), 'utf8');

    assert.equal(packageJson.name, 'my-app');
    assert.equal(envFile, 'API_URL=http://localhost:3000\n');
    assert.equal(calls.length, 0);
    assert.equal(result.gitStatus, 'skipped');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runPostScaffoldSetup runs install and git commands when enabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));

  try {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'placeholder' }, null, 2), 'utf8');

    const calls = [];
    const result = await runPostScaffoldSetup(
      {
        targetDirectory: root,
        projectName: 'test-app',
        packageManager: 'bun',
        skipInstall: false,
        skipGit: false,
      },
      async (command, args, cwd) => {
        calls.push({ command, args, cwd });
      },
    );

    assert.deepEqual(calls, [
      { command: 'bun', args: ['install'], cwd: root },
      { command: 'git', args: ['init'], cwd: root },
      { command: 'git', args: ['add', '--all'], cwd: root },
      { command: 'git', args: ['commit', '-m', 'Initial commit from create-shape-app'], cwd: root },
    ]);
    assert.equal(result.gitStatus, 'initialized');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runPostScaffoldSetup continues when git init fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));

  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'placeholder' }, null, 2), 'utf8');

    const result = await runPostScaffoldSetup(
      {
        targetDirectory: root,
        projectName: 'test-app',
        packageManager: 'bun',
        skipInstall: true,
        skipGit: false,
      },
      async (command) => {
        if (command === 'git') {
          throw new Error('git missing');
        }
      },
    );

    assert.equal(result.gitStatus, 'failed');
    assert.match(result.gitFailureMessage, /git missing/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
