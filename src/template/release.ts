export interface TemplateRelease {
  tag: string;
  tarballUrl: string;
}

export interface FetchTemplateReleaseOptions {
  owner?: string;
  repo?: string;
  templateRef?: string;
  githubToken?: string;
  fetchImpl?: typeof fetch;
  sleepImpl?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_OWNER = 'shape-network';
const DEFAULT_REPO = 'builder-kit';
const RELEASE_TAG_PATTERN = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function assertTagIsSupported(tag: string): void {
  if (!RELEASE_TAG_PATTERN.test(tag)) {
    throw new Error(
      `Invalid release tag "${tag}". Only semantic-version tags like "v1.2.3" are supported.`,
    );
  }

  if (tag.toLowerCase().includes('canary')) {
    throw new Error(`Unsupported release tag "${tag}". Canary tags are not allowed.`);
  }
}

export async function fetchTemplateRelease(options: FetchTemplateReleaseOptions = {}): Promise<TemplateRelease> {
  const owner = options.owner ?? DEFAULT_OWNER;
  const repo = options.repo ?? DEFAULT_REPO;
  const templateRef = options.templateRef;
  const githubToken = options.githubToken;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const maxAttempts = 3;

  if (templateRef) {
    assertTagIsSupported(templateRef);
  }

  const endpoint = templateRef
    ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(templateRef)}`
    : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const headers = buildHeaders(githubToken);

  let response: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetchImpl(endpoint, {
      headers,
    });

    if (response.ok) {
      break;
    }

    if (!isRetryableStatus(response.status) || attempt === maxAttempts) {
      break;
    }

    await sleepImpl(getRetryDelayMilliseconds(response, attempt));
  }

  if (!response) {
    throw new Error('Failed to resolve template release: no response received.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      if (templateRef) {
        const resolvedTag = await resolveTemplateRefTag({
          owner,
          repo,
          templateRef,
          githubToken,
          fetchImpl,
        });
        if (resolvedTag) {
          return {
            tag: resolvedTag,
            tarballUrl: buildTagTarballUrl(owner, repo, resolvedTag),
          };
        }
      } else {
        const latestTag = await resolveLatestSupportedTag({
          owner,
          repo,
          githubToken,
          fetchImpl,
        });
        if (latestTag) {
          return {
            tag: latestTag,
            tarballUrl: buildTagTarballUrl(owner, repo, latestTag),
          };
        }
      }
    }

    throw new Error(await buildReleaseLookupError(response, templateRef));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const tagName = payload.tag_name;
  const tarballUrl = payload.tarball_url;

  if (typeof tagName !== 'string' || typeof tarballUrl !== 'string') {
    throw new Error('Invalid release payload from GitHub API.');
  }

  assertTagIsSupported(tagName);

  return {
    tag: tagName,
    tarballUrl,
  };
}

function buildTagTarballUrl(owner: string, repo: string, tag: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(tag)}`;
}

function buildHeaders(githubToken: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'create-shape-app',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

async function buildReleaseLookupError(response: Response, templateRef: string | undefined): Promise<string> {
  const refLabel = templateRef ? `release tag "${templateRef}"` : 'latest release';
  const apiMessage = await readApiMessage(response);
  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0');

  if (rateLimited) {
    const resetHint = getRateLimitResetHint(response.headers.get('x-ratelimit-reset'));
    return [
      `Failed to resolve ${refLabel}: GitHub API rate limit reached (HTTP ${response.status}).`,
      resetHint,
      'Retry later or set GITHUB_TOKEN.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (apiMessage) {
    return `Failed to resolve ${refLabel}: ${apiMessage} (HTTP ${response.status}).`;
  }

  return `Failed to resolve ${refLabel}: HTTP ${response.status}.`;
}

interface TagLookupOptions {
  owner: string;
  repo: string;
  githubToken?: string;
  fetchImpl: typeof fetch;
}

async function resolveLatestSupportedTag(options: TagLookupOptions): Promise<string | undefined> {
  const tags = await fetchTagNames(options);
  return tags.find((tag) => isSupportedTag(tag));
}

async function resolveTemplateRefTag(
  options: TagLookupOptions & {
    templateRef: string;
  },
): Promise<string | undefined> {
  const tags = await fetchTagNames(options);
  const exactMatch = tags.find((tag) => tag === options.templateRef && isSupportedTag(tag));
  if (exactMatch) {
    return exactMatch;
  }

  const normalizedTemplateRef = normalizeTag(options.templateRef);
  return tags.find((tag) => normalizeTag(tag) === normalizedTemplateRef && isSupportedTag(tag));
}

async function fetchTagNames(options: TagLookupOptions): Promise<string[]> {
  const response = await options.fetchImpl(
    `https://api.github.com/repos/${options.owner}/${options.repo}/tags?per_page=100`,
    {
      headers: buildHeaders(options.githubToken),
    },
  );

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const name = (item as { name?: unknown }).name;
    return typeof name === 'string' && name.trim() ? [name] : [];
  });
}

function isSupportedTag(tag: string): boolean {
  try {
    assertTagIsSupported(tag);
    return true;
  } catch {
    return false;
  }
}

function normalizeTag(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

async function readApiMessage(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.clone().json()) as Record<string, unknown>;
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // Ignore parse failures and fall back to status-only messaging.
  }

  return undefined;
}

function getRateLimitResetHint(resetEpochSeconds: string | null): string | undefined {
  if (!resetEpochSeconds) {
    return undefined;
  }

  const reset = Number(resetEpochSeconds);
  if (!Number.isFinite(reset)) {
    return undefined;
  }

  const resetDate = new Date(reset * 1000);
  return `GitHub API reset time: ${resetDate.toISOString()}.`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function getRetryDelayMilliseconds(response: Response, attempt: number): number {
  const retryAfterHeader = response.headers.get('retry-after');
  if (retryAfterHeader) {
    const asSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
      return Math.floor(asSeconds * 1000);
    }
  }

  return Math.min(250 * attempt, 1500);
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
