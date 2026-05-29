const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

async function getCurrentHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? new URL(tab.url).hostname : null;
}

async function init() {
  const { apiKey = '' } = await chrome.storage.local.get('apiKey');
  const keyInput = document.getElementById('api-key');
  const keyStatus = document.getElementById('key-status');

  if (apiKey) {
    keyInput.value = apiKey;
    keyStatus.textContent = 'Key saved.';
    keyStatus.className = 'hint success';
  }

  document.getElementById('save-key').addEventListener('click', async () => {
    const val = keyInput.value.trim();
    if (!ANTHROPIC_KEY_RE.test(val)) {
      keyStatus.textContent = 'Invalid key format. Must start with sk-ant-';
      keyStatus.className = 'hint error';
      return;
    }
    await chrome.storage.local.set({ apiKey: val });
    keyStatus.textContent = 'Key saved.';
    keyStatus.className = 'hint success';
  });

  const host = await getCurrentHost();
  const siteHint = document.getElementById('site-hint');
  const siteToggle = document.getElementById('site-toggle');

  if (!host) {
    siteHint.textContent = 'Not on a supported page.';
    siteToggle.disabled = true;
    return;
  }

  siteHint.textContent = host;

  const { disabledHosts = [] } = await chrome.storage.local.get('disabledHosts');
  siteToggle.checked = !disabledHosts.includes(host);

  siteToggle.addEventListener('change', async () => {
    const { disabledHosts: current = [] } = await chrome.storage.local.get('disabledHosts');
    const updated = siteToggle.checked
      ? current.filter((h) => h !== host)
      : [...new Set([...current, host])];
    await chrome.storage.local.set({ disabledHosts: updated });
  });
}

init();
