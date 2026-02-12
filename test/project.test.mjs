import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { copyTemplateToDirectory, prepareTargetDirectory } from '../dist/template/project.js';

test('prepareTargetDirectory creates missing directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));
  const target = join(root, 'my-app');

  try {
    await prepareTargetDirectory(target);
    const entries = await readdir(root);
    assert.ok(entries.includes('my-app'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('prepareTargetDirectory rejects non-empty directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));
  const target = join(root, 'my-app');

  try {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'file.txt'), 'occupied');

    await assert.rejects(() => prepareTargetDirectory(target), /not empty/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('copyTemplateToDirectory copies files and excludes .git', async () => {
  const root = await mkdtemp(join(tmpdir(), 'create-shape-app-test-'));
  const templateRoot = join(root, 'template');
  const target = join(root, 'target');

  try {
    await mkdir(join(templateRoot, '.git'), { recursive: true });
    await mkdir(join(templateRoot, '.claude'), { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(templateRoot, 'README.md'), 'hello');
    await writeFile(join(templateRoot, '.git', 'config'), 'git config');
    await writeFile(join(templateRoot, '.claude', 'settings.json'), '{}');
    await writeFile(join(templateRoot, 'AGENTS.md'), 'private');
    await writeFile(join(templateRoot, 'CLAUDE.md'), 'private');

    await copyTemplateToDirectory(templateRoot, target);

    const targetEntries = await readdir(target);
    assert.ok(targetEntries.includes('README.md'));
    assert.ok(!targetEntries.includes('.git'));
    assert.ok(!targetEntries.includes('.claude'));
    assert.ok(!targetEntries.includes('AGENTS.md'));
    assert.ok(!targetEntries.includes('CLAUDE.md'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
