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
    selectPackageManager: async ({ defaultValue }) => defaultValue,
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
    runPostScaffoldSetup: async () => ({
      gitStatus: 'initialized',
    }),
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
  let promptCalls = 0;
  const { runtime, output } = createRuntime({
    stdinIsTTY: true,
    stdoutIsTTY: true,
    prompt: async () => {
      promptCalls += 1;
      return promptCalls === 1 ? 'my-app' : '';
    },
    confirm: async () => true,
  });

  const code = await runCLI([], runtime);

  assert.equal(code, 0);
  assert.ok(output.some((line) => line.includes('Scaffolded my-app from builder-kit@v1.2.3.')));
});

test('uses default-yes confirmation prompt text', async () => {
  let confirmationPrompt;
  const { runtime } = createRuntime({
    stdinIsTTY: true,
    stdoutIsTTY: true,
    confirm: async (message) => {
      confirmationPrompt = message;
      return true;
    },
  });

  const code = await runCLI(['my-app'], runtime);

  assert.equal(code, 0);
  assert.equal(confirmationPrompt, 'Continue? (Y/n): ');
});

test('prompts for package manager in interactive mode when --pm is omitted', async () => {
  let setupOptions;
  let selectOptions;
  const { runtime, output } = createRuntime({
    stdinIsTTY: true,
    stdoutIsTTY: true,
    selectPackageManager: async (options) => {
      selectOptions = options;
      return 'pnpm';
    },
    confirm: async () => true,
    runPostScaffoldSetup: async (options) => {
      setupOptions = options;
      return {
        gitStatus: 'initialized',
      };
    },
  });

  const code = await runCLI(['my-app'], runtime);

  assert.equal(code, 0);
  assert.equal(selectOptions.message, 'Package manager:');
  assert.deepEqual(selectOptions.choices, ['npm', 'pnpm', 'yarn', 'bun']);
  assert.equal(selectOptions.defaultValue, 'npm');
  assert.equal(setupOptions.packageManager, 'pnpm');
  assert.ok(output.some((line) => line.includes('  package manager: pnpm')));
});

test('uses detected package manager without prompting when --yes is set', async () => {
  let setupOptions;
  const { runtime } = createRuntime({
    env: {
      npm_config_user_agent: 'pnpm/9.0.0 node/v20.18.0 darwin x64',
    },
    stdinIsTTY: true,
    stdoutIsTTY: true,
    prompt: async () => {
      throw new Error('prompt should not run');
    },
    runPostScaffoldSetup: async (options) => {
      setupOptions = options;
      return {
        gitStatus: 'initialized',
      };
    },
  });

  const code = await runCLI(['my-app', '--yes'], runtime);

  assert.equal(code, 0);
  assert.equal(setupOptions.packageManager, 'pnpm');
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

test('does not print usage help for non-usage errors', async () => {
  const { runtime, errors } = createRuntime({
    resolveTemplateRelease: async () => {
      throw new Error('release lookup failed');
    },
  });

  const code = await runCLI(['my-app', '--yes'], runtime);

  assert.equal(code, 1);
  assert.ok(errors.some((line) => line.includes('release lookup failed')));
  assert.ok(!errors.some((line) => line.includes('Usage:')));
});

test('continues when git setup fails and prints warning', async () => {
  const { runtime, output, errors } = createRuntime({
    runPostScaffoldSetup: async () => ({
      gitStatus: 'failed',
      gitFailureMessage: 'git missing',
    }),
  });

  const code = await runCLI(['my-app', '--yes'], runtime);

  assert.equal(code, 0);
  assert.ok(output.some((line) => line.includes('Git setup: skipped due to git initialization failure')));
  assert.ok(errors.some((line) => line.includes('Warning: git missing')));
});
