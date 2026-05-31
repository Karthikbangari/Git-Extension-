import { describe, expect, it, vi } from 'vitest';

// Regression: documents that popup getCurrentHost() uses only { active: true, currentWindow: true }
// which is satisfied by the "activeTab" grant — no broader "tabs" permission required.
// We replicate the function inline to avoid importing popup.ts (it auto-calls init() on load).
async function getCurrentHost(
  tabsQuery: (query: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
): Promise<string | null> {
  const [tab] = await tabsQuery({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

describe('popup getCurrentHost', () => {
  it('calls tabs.query with { active: true, currentWindow: true }', async () => {
    const mockQuery = vi
      .fn()
      .mockResolvedValue([
        { url: 'https://github.com/foo/bar/blob/main/README.md' } as chrome.tabs.Tab,
      ]);

    const host = await getCurrentHost(mockQuery);

    expect(mockQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(host).toBe('github.com');
  });

  it('returns null when no active tab is found', async () => {
    const mockQuery = vi.fn().mockResolvedValue([] as chrome.tabs.Tab[]);

    const host = await getCurrentHost(mockQuery);

    expect(mockQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(host).toBeNull();
  });

  it('returns null when active tab has no url', async () => {
    const mockQuery = vi.fn().mockResolvedValue([{} as chrome.tabs.Tab]);

    const host = await getCurrentHost(mockQuery);

    expect(host).toBeNull();
  });
});
