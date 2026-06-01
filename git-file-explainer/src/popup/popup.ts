import { getApiKey, getTokenUsage } from '../utils/storage';

const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

async function isManagedApiKey(): Promise<boolean> {
  try {
    const { apiKey } = await chrome.storage.managed.get('apiKey');
    return !!apiKey;
  } catch {
    return false;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

async function init(): Promise<void> {
  const [apiKey, managed] = await Promise.all([getApiKey(), isManagedApiKey()]);
  const keyInput = document.getElementById('api-key') as HTMLInputElement;
  const keyStatus = document.getElementById('key-status') as HTMLParagraphElement;
  const saveBtn = document.getElementById('save-key') as HTMLButtonElement;
  const banner = document.getElementById('onboarding-banner') as HTMLElement;

  if (managed) {
    keyInput.value = apiKey ?? '';
    keyInput.disabled = true;
    saveBtn.disabled = true;
    keyStatus.textContent = 'This setting is managed by your organization.';
    keyStatus.className = 'hint';
  } else if (apiKey) {
    keyInput.value = apiKey;
    keyStatus.textContent = 'Key saved.';
    keyStatus.className = 'hint success';
  } else {
    banner.style.display = 'block';
  }

  if (!managed) {
    saveBtn.addEventListener('click', async () => {
      const val = keyInput.value.trim();
      if (!ANTHROPIC_KEY_RE.test(val)) {
        keyStatus.textContent = 'Invalid key format. Must start with sk-ant-';
        keyStatus.className = 'hint error';
        return;
      }
      await chrome.storage.local.set({ apiKey: val });
      keyStatus.textContent = 'Key saved.';
      keyStatus.className = 'hint success';
      banner.style.display = 'none';
      chrome.action.setBadgeText({ text: '' });
    });
  }

  // ── Token usage ────────────────────────────────────────
  const usage = await getTokenUsage();
  const inputEl = document.getElementById('token-input') as HTMLElement;
  const outputEl = document.getElementById('token-output') as HTMLElement;
  const totalEl = document.getElementById('token-total') as HTMLElement;
  const resetBtn = document.getElementById('reset-tokens') as HTMLButtonElement;

  const renderUsage = (u: { inputTokens: number; outputTokens: number }) => {
    inputEl.textContent = formatTokens(u.inputTokens);
    outputEl.textContent = formatTokens(u.outputTokens);
    totalEl.textContent = formatTokens(u.inputTokens + u.outputTokens);
  };
  renderUsage(usage);

  resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ gfe_token_usage: { inputTokens: 0, outputTokens: 0 } });
    renderUsage({ inputTokens: 0, outputTokens: 0 });
  });

  // ── Dashboard link ─────────────────────────────────────
  document.getElementById('open-dashboard')?.addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
  });
}

init();
