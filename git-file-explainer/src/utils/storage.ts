const GFE_PREFIX = 'gfe_';

export async function getApiKey(): Promise<string | null> {
  try {
    const { apiKey: managedKey } = await chrome.storage.managed.get('apiKey');
    if (managedKey) return managedKey as string;
  } catch {
    // managed storage unavailable
  }
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey as string) || null;
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

export function gfeCacheKey(id: string): string {
  return `${GFE_PREFIX}${id}`;
}
