import type { ResourceChange, DependencyGraph, AISummaryResult } from '../content/types';

type SerializedGraph = Record<string, string[]>;

function cacheKey(url: string): string {
  return `tfe_cache_${url}`;
}

function serializeGraph(graph: DependencyGraph): SerializedGraph {
  const obj: SerializedGraph = {};
  for (const [k, v] of graph) obj[k] = [...v];
  return obj;
}

function deserializeGraph(obj: SerializedGraph): DependencyGraph {
  const map: DependencyGraph = new Map();
  for (const [k, v] of Object.entries(obj)) map.set(k, new Set(v));
  return map;
}

export async function getCachedAnalysis(
  url: string
): Promise<{ changes: ResourceChange[]; graph: DependencyGraph } | null> {
  const key = cacheKey(url);
  const result = await chrome.storage.session.get(key);
  const entry = result[key] as { changes: ResourceChange[]; graph: SerializedGraph } | undefined;
  if (!entry) return null;
  return { changes: entry.changes, graph: deserializeGraph(entry.graph) };
}

export async function setCachedAnalysis(
  url: string,
  changes: ResourceChange[],
  graph: DependencyGraph
): Promise<void> {
  await chrome.storage.session.set({
    [cacheKey(url)]: { changes, graph: serializeGraph(graph) },
  });
}

export async function clearCachedAnalysis(url: string): Promise<void> {
  await chrome.storage.session.remove(cacheKey(url));
}

export async function getApiKey(): Promise<string | null> {
  try {
    const { apiKey: managedKey } = await chrome.storage.managed.get('apiKey');
    if (managedKey) return managedKey as string;
  } catch {
    // managed storage unavailable (no enterprise policy deployed)
  }
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey as string) || null;
}

export async function isManagedApiKey(): Promise<boolean> {
  try {
    const { apiKey } = await chrome.storage.managed.get('apiKey');
    return !!apiKey;
  } catch {
    return false;
  }
}

export async function isManagedDisabledHosts(): Promise<boolean> {
  try {
    const { disabledHosts } = await chrome.storage.managed.get('disabledHosts');
    return Array.isArray(disabledHosts);
  } catch {
    return false;
  }
}

export async function isEnabledForHost(host: string): Promise<boolean> {
  try {
    const { disabledHosts: managedDisabled } = await chrome.storage.managed.get('disabledHosts');
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

function aiCacheKey(hash: string): string {
  return `tfe_ai_${hash}`;
}

export async function getCachedAISummary(hash: string): Promise<AISummaryResult | null> {
  const key = aiCacheKey(hash);
  const result = await chrome.storage.local.get(key);
  return (result[key] as AISummaryResult) ?? null;
}

export async function setCachedAISummary(hash: string, result: AISummaryResult): Promise<void> {
  await chrome.storage.local.set({ [aiCacheKey(hash)]: result });
}
