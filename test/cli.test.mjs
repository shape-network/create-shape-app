import assert from 'node:assert/strict';
import test from 'node:test';

import { runCLI } from '../dist/index.js';

function createRuntime(overrides = {}) {
  const output = [];
  const errors = [];

  const runtime = {
    env: {},
    stdinIsTTY: false,
    stdoutIsTTY: false,
    print: (message) => output.push(String(message)),
    printError: (message) => errors.push(String(message)),
    prompt: async () => '',
    confirm: async () => true,
    cwd: '/tmp',
    resolveTemplateRelease: async () => ({
      tag: 'v1.2.3',
      tarballUrl: 'https://example.com/template.tar.gz',
    }),
    materializeTemplate: async () => ({
      templateRoot: '/tmp/template',
      cleanup: async () => {},
    }),
    prepareTargetDirectory: async () => {},
    copyTemplateToDirectory: async () => {},
    runPostScaffoldSetup: async () => {},
    ...overrides,
  };

  return { runtime, output, errors };
}

test('fails when project name is missing in non-interactive mode', async () => {
  const { runtime, errors } = createRuntime();

  const code = await runCLI([], runtime);

  assert.equal(code, 1);
  assert.ok(errors.some((line) => line.includes('Missing required project name.')));
});

test('prompts for project name in interactive mode', async () => {
  const { runtime, output } = createRuntime({
    stdinIsTTY: true,
    stdoutIsTTY: true,
    prompt: async () => 'my-app',
    confirm: async () => true,
  });

  const code = await runCLI([], runtime);

  assert.equal(code, 0);
  assert.ok(output.some((line) => line.includes('Scaffolded my-app from builder-kit@v1.2.3.')));
});

test('requires --yes in non-interactive mode when project name is provided', async () => {
  const { runtime, errors } = createRuntime();

  const code = await runCLI(['my-app'], runtime);

  assert.equal(code, 1);
  assert.ok(errors.some((line) => line.includes('Re-run with --yes to proceed.')));
});

test('skips confirmation prompt when --yes is used', async () => {
  const { runtime, output } = createRuntime({
    confirm: async () => {
      throw new Error('confirm should not run');
    },
  });

  const code = await runCLI(['my-app', '--yes'], runtime);

  assert.equal(code, 0);
  assert.ok(output.some((line) => line.includes('Scaffolded my-app from builder-kit@v1.2.3.')));
});

test('rejects invalid project names', async () => {
  const { runtime, errors } = createRuntime({
    stdinIsTTY: true,
    stdoutIsTTY: true,
    confirm: async () => true,
  });

  const code = await runCLI(['bad/name'], runtime);

  assert.equal(code, 1);
  assert.ok(errors.some((line) => line.includes('Invalid project name:')));
});
