import assert from 'node:assert/strict';
import test from 'node:test';

import { materializeTemplateFromRelease } from '../dist/template/materialize.js';

test('download request omits octet-stream accept header', async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push(init);
    return new Response('', { status: 500 });
  };

  await assert.rejects(
    () =>
      materializeTemplateFromRelease(
        {
          tag: 'main',
          tarballUrl: 'https://api.github.com/repos/shape-network/builder-kit/tarball/main',
        },
        fetchImpl,
      ),
    /Failed to download template tarball: HTTP 500/,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers['User-Agent'], 'create-shape-app');
  assert.equal(calls[0].headers.Accept, undefined);
});
