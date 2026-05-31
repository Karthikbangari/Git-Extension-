import type { FileSummaryResult } from '../content/types';

const GFE_PREFIX = 'gfe_';
const STORAGE_TIMEOUT_MS = 500;

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

export function gfeCacheKey(id: string): string {
  return `${GFE_PREFIX}${id}`;
}

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCachedSummary(url: string): Promise<FileSummaryResult | null> {
  try {
    const key = gfeCacheKey(`summary_${await hashUrl(url)}`);
    const result = await chrome.storage.local.get(key);
    return (result[key] as FileSummaryResult) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedSummary(url: string, result: FileSummaryResult): Promise<void> {
  try {
    const key = gfeCacheKey(`summary_${await hashUrl(url)}`);
    await chrome.storage.local.set({ [key]: result });
  } catch {
    // best-effort — never blocks render
  }
}
