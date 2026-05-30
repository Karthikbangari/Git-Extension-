import { getApiKey } from '../utils/storage';

void chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({ disabledHosts: [], apiKey: null });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GFE_FETCH_AI_SUMMARY') return false;

  const { prompt, model } = message.payload as { prompt: string; model: string };

  void (async () => {
    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        sendResponse({ error: 'Missing API key' });
        return;
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        sendResponse({ error: body?.error?.message ?? `HTTP ${res.status}` });
        return;
      }

      sendResponse(await res.json());
    } catch (err) {
      sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })();

  return true; // keep channel open for async sendResponse
});
