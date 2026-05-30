import { getApiKey, isEnabledForHost } from '../utils/storage';

const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

async function getCurrentHost(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

async function isManagedApiKey(): Promise<boolean> {
  try {
    const { apiKey } = await chrome.storage.managed.get('apiKey');
    return !!apiKey;
  } catch {
    return false;
  }
}

async function isManagedDisabledHosts(): Promise<boolean> {
  try {
    const { disabledHosts } = await chrome.storage.managed.get('disabledHosts');
    return Array.isArray(disabledHosts);
  } catch {
    return false;
  }
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

  const host = await getCurrentHost();
  const siteHint = document.getElementById('site-hint') as HTMLParagraphElement;
  const siteToggle = document.getElementById('site-toggle') as HTMLInputElement;

  if (!host) {
    siteHint.textContent = 'Not on a supported page.';
    siteToggle.disabled = true;
    return;
  }

  siteHint.textContent = host;

  const [enabled, managedHosts] = await Promise.all([
    isEnabledForHost(host),
    isManagedDisabledHosts(),
  ]);
  siteToggle.checked = enabled;

  if (managedHosts) {
    siteToggle.disabled = true;
    siteHint.textContent = `${host} — managed by your organization`;
  } else {
    siteToggle.addEventListener('change', async () => {
      const { disabledHosts: current = [] } = await chrome.storage.local.get('disabledHosts');
      const updated = siteToggle.checked
        ? (current as string[]).filter((h) => h !== host)
        : [...new Set([...(current as string[]), host])];
      await chrome.storage.local.set({ disabledHosts: updated });
    });
  }
}

init();
