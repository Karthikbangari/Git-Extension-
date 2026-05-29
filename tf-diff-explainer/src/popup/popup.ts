const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

async function getCurrentHost(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

async function init(): Promise<void> {
  const { apiKey = '' } = await chrome.storage.local.get('apiKey');
  const keyInput = document.getElementById('api-key') as HTMLInputElement;
  const keyStatus = document.getElementById('key-status') as HTMLParagraphElement;
  const banner = document.getElementById('onboarding-banner') as HTMLElement;

  if (apiKey) {
    keyInput.value = apiKey as string;
    keyStatus.textContent = 'Key saved.';
    keyStatus.className = 'hint success';
  } else {
    banner.style.display = 'block';
  }

  document.getElementById('save-key')?.addEventListener('click', async () => {
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

  const host = await getCurrentHost();
  const siteHint = document.getElementById('site-hint') as HTMLParagraphElement;
  const siteToggle = document.getElementById('site-toggle') as HTMLInputElement;

  if (!host) {
    siteHint.textContent = 'Not on a supported page.';
    siteToggle.disabled = true;
    return;
  }

  siteHint.textContent = host;

  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  siteToggle.checked = !(disabledHosts as string[]).includes(host);

  siteToggle.addEventListener('change', async () => {
    const { disabledHosts: current = [] } = await chrome.storage.local.get('disabledHosts');
    const updated = siteToggle.checked
      ? (current as string[]).filter((h) => h !== host)
      : [...new Set([...(current as string[]), host])];
    await chrome.storage.local.set({ disabledHosts: updated });
  });
}

init();
