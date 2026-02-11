import assert from 'node:assert/strict';
import test from 'node:test';

import { assertTagIsSupported, fetchTemplateRelease } from '../dist/template/release.js';

test('accepts semantic version tags', () => {
  assert.doesNotThrow(() => assertTagIsSupported('v1.2.3'));
  assert.doesNotThrow(() => assertTagIsSupported('1.2.3'));
  assert.doesNotThrow(() => assertTagIsSupported('v1.2.3-rc.1'));
});

test('rejects non-tag or canary refs', () => {
  assert.throws(() => assertTagIsSupported('main'), /Invalid release tag/);
  assert.throws(() => assertTagIsSupported('refs/tags/v1.2.3'), /Invalid release tag/);
  assert.throws(() => assertTagIsSupported('v1.2.3-canary.0'), /Canary tags are not allowed/);
});

test('fetches latest release endpoint by default', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({
        tag_name: 'v2.0.0',
        tarball_url: 'https://example.com/release.tar.gz',
      }),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({ fetchImpl });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/releases/latest'));
  assert.equal(release.tag, 'v2.0.0');
});

test('fetches explicit tag endpoint', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return new Response(
      JSON.stringify({
        tag_name: 'v2.1.0',
        tarball_url: 'https://example.com/release.tar.gz',
      }),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({
    templateRef: 'v2.1.0',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('/releases/tags/v2.1.0'));
  assert.equal(release.tag, 'v2.1.0');
});
