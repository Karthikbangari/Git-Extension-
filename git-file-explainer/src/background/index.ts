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

// ── Batch message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = (message as { type?: string }).type;

  if (type === 'GFE_FETCH_AI_SUMMARY' || type === 'GFE_FETCH_QA_ANSWER') {
    const { prompt, model } = (message as { payload: { prompt: string; model: string } }).payload;
    void handleBatchAI(prompt, model, sendResponse);
    return true;
  }

  if (type === 'GFE_FETCH_RAW_CONTENT') {
    const { url } = (message as { payload: { url: string } }).payload;
    void handleRawContent(url, sendResponse);
    return true;
  }

  return false;
});

async function handleBatchAI(
  prompt: string,
  model: string,
  sendResponse: (r: unknown) => void
): Promise<void> {
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
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      sendResponse({ error: body?.error?.message ?? `HTTP ${res.status}` });
      return;
    }
    sendResponse(await res.json());
  } catch (err) {
    sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

async function handleRawContent(url: string, sendResponse: (r: unknown) => void): Promise<void> {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/plain' } });
    if (!res.ok) {
      sendResponse({ error: `HTTP ${res.status}` });
      return;
    }
    const text = await res.text();
    sendResponse({ text });
  } catch (err) {
    sendResponse({ error: err instanceof Error ? err.message : 'fetch failed' });
  }
}

// ── Streaming port handler ───────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'gfe-stream-qa') return;

  port.onMessage.addListener((msg: unknown) => {
    const m = msg as { type?: string; payload?: { prompt: string; model: string } };
    if (m.type !== 'GFE_STREAM_QA' || !m.payload) return;
    void streamQA(m.payload.prompt, m.payload.model, port);
  });
});

async function streamQA(prompt: string, model: string, port: chrome.runtime.Port): Promise<void> {
  let apiKey: string | null;
  try {
    apiKey = await getApiKey();
  } catch {
    port.postMessage({ error: 'storage error' });
    return;
  }

  if (!apiKey) {
    port.postMessage({ error: 'Missing API key' });
    return;
  }

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
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
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    port.postMessage({ error: err instanceof Error ? err.message : 'fetch failed' });
    return;
  }

  if (!res.ok || !res.body) {
    port.postMessage({ error: `HTTP ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text
          ) {
            try {
              port.postMessage({ chunk: event.delta.text });
            } catch {
              break;
            }
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  try {
    port.postMessage({ done: true });
  } catch {
    /* port may be closed */
  }
}
