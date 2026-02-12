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
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
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
  assert.ok(calls[0].url.endsWith('/releases/latest'));
  assert.equal(calls[0].init.headers['User-Agent'], 'create-shape-app');
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

test('falls back to latest supported tag when latest release is missing', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));

    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          message: 'Not Found',
        }),
        { status: 404 },
      );
    }

    return new Response(
      JSON.stringify([
        { name: 'main' },
        { name: 'v2.2.0-canary.0' },
        { name: 'v2.1.0' },
      ]),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({ fetchImpl });

  assert.equal(calls.length, 2);
  assert.ok(calls[0].endsWith('/releases/latest'));
  assert.ok(calls[1].includes('/tags?per_page=100'));
  assert.equal(release.tag, 'v2.1.0');
  assert.equal(release.tarballUrl, 'https://api.github.com/repos/shape-network/builder-kit/tarball/v2.1.0');
});

test('falls back to default branch when latest release and tags are missing', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));

    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          message: 'Not Found',
        }),
        { status: 404 },
      );
    }

    if (calls.length === 2) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    return new Response(
      JSON.stringify({
        default_branch: 'main',
      }),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({ fetchImpl });

  assert.equal(calls.length, 3);
  assert.ok(calls[0].endsWith('/releases/latest'));
  assert.ok(calls[1].includes('/tags?per_page=100'));
  assert.ok(calls[2].endsWith('/repos/shape-network/builder-kit'));
  assert.equal(release.tag, 'main');
  assert.equal(release.tarballUrl, 'https://api.github.com/repos/shape-network/builder-kit/tarball/main');
});

test('falls back to tags for explicit template ref when release endpoint is missing', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));

    if (calls.length === 1) {
      return new Response(
        JSON.stringify({
          message: 'Not Found',
        }),
        { status: 404 },
      );
    }

    return new Response(
      JSON.stringify([
        { name: 'v2.1.0' },
        { name: 'v2.0.0' },
      ]),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({
    templateRef: '2.1.0',
    fetchImpl,
  });

  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes('/releases/tags/2.1.0'));
  assert.ok(calls[1].includes('/tags?per_page=100'));
  assert.equal(release.tag, 'v2.1.0');
  assert.equal(release.tarballUrl, 'https://api.github.com/repos/shape-network/builder-kit/tarball/v2.1.0');
});

test('retries on 429 and succeeds on subsequent attempt', async () => {
  const calls = [];
  const sleeps = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));

    if (calls.length === 1) {
      return new Response('', {
        status: 429,
        headers: { 'retry-after': '0' },
      });
    }

    return new Response(
      JSON.stringify({
        tag_name: 'v3.0.0',
        tarball_url: 'https://example.com/release.tar.gz',
      }),
      { status: 200 },
    );
  };

  const release = await fetchTemplateRelease({
    fetchImpl,
    sleepImpl: async (milliseconds) => {
      sleeps.push(milliseconds);
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(sleeps.length, 1);
  assert.equal(sleeps[0], 0);
  assert.equal(release.tag, 'v3.0.0');
});

test('fails after retry budget is exhausted', async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response('', { status: 502 });
  };

  await assert.rejects(
    () =>
      fetchTemplateRelease({
        fetchImpl,
        sleepImpl: async () => {},
      }),
    /Failed to resolve latest release: HTTP 502/,
  );

  assert.equal(callCount, 3);
});

test('includes auth header when github token is provided', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        tag_name: 'v2.0.0',
        tarball_url: 'https://example.com/release.tar.gz',
      }),
      { status: 200 },
    );
  };

  await fetchTemplateRelease({
    githubToken: 'secret-token',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('returns actionable message for rate limit responses', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        message: 'API rate limit exceeded',
      }),
      {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1735689600',
        },
      },
    );

  await assert.rejects(
    () =>
      fetchTemplateRelease({
        fetchImpl,
      }),
    /set GITHUB_TOKEN/,
  );
});
