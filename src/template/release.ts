export interface TemplateRelease {
  tag: string;
  tarballUrl: string;
}

export interface FetchTemplateReleaseOptions {
  owner?: string;
  repo?: string;
  templateRef?: string;
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
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const maxAttempts = 3;

  if (templateRef) {
    assertTagIsSupported(templateRef);
  }

  const endpoint = templateRef
    ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(templateRef)}`
    : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  let response: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetchImpl(endpoint, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'create-shape-app',
      },
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
    const refLabel = templateRef ? `release tag "${templateRef}"` : 'latest release';
    throw new Error(`Failed to resolve ${refLabel}: HTTP ${response.status}`);
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
