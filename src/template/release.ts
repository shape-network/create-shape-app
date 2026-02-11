export interface TemplateRelease {
  tag: string;
  tarballUrl: string;
}

export interface FetchTemplateReleaseOptions {
  owner?: string;
  repo?: string;
  templateRef?: string;
  fetchImpl?: typeof fetch;
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

  if (templateRef) {
    assertTagIsSupported(templateRef);
  }

  const endpoint = templateRef
    ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(templateRef)}`
    : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const response = await fetchImpl(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'create-shape-app',
    },
  });

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
