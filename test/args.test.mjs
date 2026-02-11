import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs } from '../dist/cli/args.js';

test('parses positional project name and bool flags', () => {
  const actual = parseArgs(['my-app', '--yes', '--skip-install', '--skip-git']);

  assert.deepEqual(actual, {
    help: false,
    version: false,
    yes: true,
    skipInstall: true,
    skipGit: true,
    projectName: 'my-app',
  });
});

test('parses package manager via equals form', () => {
  const actual = parseArgs(['my-app', '--pm=pnpm']);

  assert.equal(actual.packageManager, 'pnpm');
  assert.equal(actual.projectName, 'my-app');
});

test('supports template-ref value', () => {
  const actual = parseArgs(['my-app', '--template-ref', 'v0.1.0']);

  assert.equal(actual.templateRef, 'v0.1.0');
});

test('throws for unknown options', () => {
  assert.throws(() => parseArgs(['my-app', '--bogus']), /Unknown option/);
});

test('throws for missing --pm value', () => {
  assert.throws(() => parseArgs(['my-app', '--pm']), /Missing value for --pm/);
});
