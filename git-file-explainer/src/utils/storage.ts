import type { FileSummaryResult } from '../content/types';

const GFE_PREFIX = 'gfe_';
const STORAGE_TIMEOUT_MS = 500;
const CACHE_PRESSURE_BYTES = 3_800_000; // evict when above ~3.8 MB
const LRU_INDEX_KEY = `${GFE_PREFIX}lru_index`;

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), STORAGE_TIMEOUT_MS);
    }),
  ]);
}

export async function getApiKey(): Promise<string | null> {
  try {
    const { apiKey: managedKey } = await withTimeout(
      chrome.storage.managed.get('apiKey'),
      {} as Record<string, unknown>
    );
    if (managedKey) return managedKey as string;
  } catch {
    // managed storage unavailable
  }
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey as string) || null;
}

export async function isEnabledForHost(host: string): Promise<boolean> {
  try {
    const { disabledHosts: managedDisabled } = await withTimeout(
      chrome.storage.managed.get('disabledHosts'),
      {} as Record<string, unknown>
    );
    if (Array.isArray(managedDisabled)) {
      return !(managedDisabled as string[]).includes(host);
    }
  } catch {
    // managed storage unavailable
  }
  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  return !(disabledHosts as string[]).includes(host);
}

export async function toggleHost(host: string, enabled: boolean): Promise<void> {
  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  const current = disabledHosts as string[];
  const updated = enabled ? current.filter((h) => h !== host) : [...new Set([...current, host])];
  await chrome.storage.local.set({ disabledHosts: updated });
}

// ── Cache key helpers ────────────────────────────────────────────────────────

export function normaliseCacheKey(url: string): string {
  try {
    const u = new URL(url);
    // GitHub: /owner/repo/blob/branch/path/to/file
    const githubMatch = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (githubMatch) {
      const [, owner, repo, branch, path] = githubMatch;
      return `${owner}_${repo}_${branch}_${path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    // GitLab: /owner/repo/-/blob/branch/path/to/file
    const gitlabMatch = u.pathname.match(/^\/(.+)\/-\/blob\/([^/]+)\/(.+)$/);
    if (gitlabMatch) {
      const [, ownerRepo, branch, path] = gitlabMatch;
      return `${ownerRepo}_${branch}_${path}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
  } catch {
    // fall through to hash
  }
  return hashUrlSync(url);
}

function hashUrlSync(url: string): string {
  // Simple djb2 hash for sync fallback
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h) ^ url.charCodeAt(i);
  return (h >>> 0).toString(16);
}

export function gfeCacheKey(id: string): string {
  return `${GFE_PREFIX}${id}`;
}

// ── LRU index ────────────────────────────────────────────────────────────────

async function getLruIndex(): Promise<string[]> {
  const res = await chrome.storage.local.get(LRU_INDEX_KEY).catch(() => ({}));
  const arr = (res as Record<string, unknown>)[LRU_INDEX_KEY];
  return Array.isArray(arr) ? (arr as string[]) : [];
}

async function saveLruIndex(index: string[]): Promise<void> {
  await chrome.storage.local.set({ [LRU_INDEX_KEY]: index }).catch(() => {});
}

export async function evictLRU(): Promise<void> {
  try {
    const bytesUsed = await chrome.storage.local.getBytesInUse();
    if (bytesUsed < CACHE_PRESSURE_BYTES) return;

    const index = await getLruIndex();
    const toRemove = index.splice(0, Math.ceil(index.length / 3));
    if (toRemove.length === 0) return;
    await chrome.storage.local.remove(toRemove);
    await saveLruIndex(index);
  } catch {
    // best-effort
  }
}

// ── Summary cache ────────────────────────────────────────────────────────────

interface CacheEntry {
  result: FileSummaryResult;
  ts: number;
}

export interface CachedSummaryMeta {
  result: FileSummaryResult;
  ts: number;
}

export async function getCachedSummaryWithMeta(url: string): Promise<CachedSummaryMeta | null> {
  try {
    const key = gfeCacheKey(`summary_${normaliseCacheKey(url)}`);
    const res = await chrome.storage.local.get(key);
    const entry = (res as Record<string, unknown>)[key] as CacheEntry | undefined;
    if (!entry?.result) return null;
    return { result: entry.result, ts: entry.ts ?? 0 };
  } catch {
    return null;
  }
}

/** @deprecated Use getCachedSummaryWithMeta */
export async function getCachedSummary(url: string): Promise<FileSummaryResult | null> {
  const meta = await getCachedSummaryWithMeta(url);
  return meta?.result ?? null;
}

export async function setCachedSummary(url: string, result: FileSummaryResult): Promise<void> {
  try {
    await evictLRU();
    const key = gfeCacheKey(`summary_${normaliseCacheKey(url)}`);
    const entry: CacheEntry = { result, ts: Date.now() };
    await chrome.storage.local.set({ [key]: entry });

    // Update LRU index
    const index = await getLruIndex();
    const updated = [key, ...index.filter((k) => k !== key)];
    await saveLruIndex(updated);
  } catch {
    // best-effort — never blocks render
  }
}

// ── Token usage ──────────────────────────────────────────────────────────────

const TOKEN_USAGE_KEY = `${GFE_PREFIX}token_usage`;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export async function getTokenUsage(): Promise<TokenUsage> {
  try {
    const res = await chrome.storage.local.get(TOKEN_USAGE_KEY);
    const u = (res as Record<string, unknown>)[TOKEN_USAGE_KEY] as Partial<TokenUsage> | undefined;
    return { inputTokens: u?.inputTokens ?? 0, outputTokens: u?.outputTokens ?? 0 };
  } catch {
    return { inputTokens: 0, outputTokens: 0 };
  }
}

export async function addTokenUsage(input: number, output: number): Promise<void> {
  try {
    const current = await getTokenUsage();
    await chrome.storage.local.set({
      [TOKEN_USAGE_KEY]: {
        inputTokens: current.inputTokens + input,
        outputTokens: current.outputTokens + output,
      },
    });
  } catch {
    // best-effort
  }
}

// ── Audience + auto-trigger ──────────────────────────────────────────────────

export type Audience = 'developer' | 'non-technical';

export async function getAudience(): Promise<Audience> {
  const res = await chrome.storage.local.get(`${GFE_PREFIX}audience`).catch(() => ({}));
  return ((res as Record<string, unknown>)[`${GFE_PREFIX}audience`] as Audience) ?? 'developer';
}

export async function setAudience(audience: Audience): Promise<void> {
  await chrome.storage.local.set({ [`${GFE_PREFIX}audience`]: audience });
}

export async function getAutoTrigger(): Promise<boolean> {
  const res = await chrome.storage.local.get(`${GFE_PREFIX}auto_trigger`).catch(() => ({}));
  const val = (res as Record<string, unknown>)[`${GFE_PREFIX}auto_trigger`];
  return val === undefined ? true : Boolean(val);
}

export async function setAutoTrigger(value: boolean): Promise<void> {
  await chrome.storage.local.set({ [`${GFE_PREFIX}auto_trigger`]: value });
}

// ── Per-repo opt-out ─────────────────────────────────────────────────────────

const DISABLED_REPOS_KEY = `${GFE_PREFIX}disabled_repos`;

export async function getDisabledRepos(): Promise<string[]> {
  const res = await chrome.storage.local.get(DISABLED_REPOS_KEY).catch(() => ({}));
  const arr = (res as Record<string, unknown>)[DISABLED_REPOS_KEY];
  return Array.isArray(arr) ? (arr as string[]) : [];
}

export function repoFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  } catch {
    // ignore
  }
  return null;
}

export async function isRepoEnabled(url: string): Promise<boolean> {
  const repo = repoFromUrl(url);
  if (!repo) return true;
  const disabled = await getDisabledRepos();
  return !disabled.includes(repo);
}

export async function toggleRepo(repo: string, enabled: boolean): Promise<void> {
  const current = await getDisabledRepos();
  const updated = enabled ? current.filter((r) => r !== repo) : [...new Set([...current, repo])];
  await chrome.storage.local.set({ [DISABLED_REPOS_KEY]: updated });
}

// ── Custom GitLab domain ──────────────────────────────────────────────────────

const CUSTOM_GITLAB_KEY = `${GFE_PREFIX}custom_gitlab_domain`;

export async function getCustomGitLabDomain(): Promise<string | null> {
  const res = await chrome.storage.local.get(CUSTOM_GITLAB_KEY).catch(() => ({}));
  const val = (res as Record<string, unknown>)[CUSTOM_GITLAB_KEY];
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

export async function setCustomGitLabDomain(domain: string | null): Promise<void> {
  if (domain) {
    await chrome.storage.local.set({ [CUSTOM_GITLAB_KEY]: domain.trim() });
  } else {
    await chrome.storage.local.remove(CUSTOM_GITLAB_KEY);
  }
}
