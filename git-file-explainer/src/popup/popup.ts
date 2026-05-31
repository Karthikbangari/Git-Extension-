import {
  getApiKey,
  isEnabledForHost,
  toggleHost,
  getAudience,
  setAudience,
  getAutoTrigger,
  setAutoTrigger,
  getTokenUsage,
  getCustomGitLabDomain,
  setCustomGitLabDomain,
  repoFromUrl,
  getDisabledRepos,
  toggleRepo,
} from '../utils/storage';
import type { Audience } from '../utils/storage';

const ANTHROPIC_KEY_RE = /^sk-ant-[A-Za-z0-9\-_]{20,}$/;

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

async function getCurrentTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

async function getCurrentHost(): Promise<string | null> {
  const url = await getCurrentTabUrl();
  return url ? new URL(url).hostname : null;
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

  // ── Site toggle ────────────────────────────────────────
  const host = await getCurrentHost();
  const siteHint = document.getElementById('site-hint') as HTMLParagraphElement;
  const siteToggle = document.getElementById('site-toggle') as HTMLInputElement;

  if (!host) {
    siteHint.textContent = 'Not on a supported page.';
    siteToggle.disabled = true;
  } else {
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
      siteToggle.addEventListener('change', () => void toggleHost(host, siteToggle.checked));
    }
  }

  // ── Per-repo toggle ────────────────────────────────────
  const tabUrl = await getCurrentTabUrl();
  const repo = tabUrl ? repoFromUrl(tabUrl) : null;
  const repoSection = document.getElementById('repo-section') as HTMLElement;
  const repoToggle = document.getElementById('repo-toggle') as HTMLInputElement;
  const repoHint = document.getElementById('repo-hint') as HTMLParagraphElement;

  if (repo) {
    repoSection.style.display = '';
    repoHint.textContent = repo;
    const disabledRepos = await getDisabledRepos();
    repoToggle.checked = !disabledRepos.includes(repo);
    repoToggle.addEventListener('change', () => void toggleRepo(repo, repoToggle.checked));
  }

  // ── Audience mode ──────────────────────────────────────
  const audience = await getAudience();
  const devBtn = document.getElementById('mode-dev') as HTMLButtonElement;
  const nonTechBtn = document.getElementById('mode-nontech') as HTMLButtonElement;

  const setActiveMode = (mode: Audience) => {
    devBtn.classList.toggle('active', mode === 'developer');
    nonTechBtn.classList.toggle('active', mode === 'non-technical');
  };
  setActiveMode(audience);

  devBtn.addEventListener('click', () => {
    void setAudience('developer');
    setActiveMode('developer');
  });
  nonTechBtn.addEventListener('click', () => {
    void setAudience('non-technical');
    setActiveMode('non-technical');
  });

  // ── Auto-trigger toggle ────────────────────────────────
  const autoTriggerToggle = document.getElementById('auto-trigger') as HTMLInputElement;
  autoTriggerToggle.checked = await getAutoTrigger();
  autoTriggerToggle.addEventListener(
    'change',
    () => void setAutoTrigger(autoTriggerToggle.checked)
  );

  // ── Custom GitLab domain ───────────────────────────────
  const gitlabInput = document.getElementById('gitlab-domain') as HTMLInputElement;
  const gitlabStatus = document.getElementById('gitlab-status') as HTMLParagraphElement;
  const saveGitlab = document.getElementById('save-gitlab') as HTMLButtonElement;

  const currentDomain = await getCustomGitLabDomain();
  if (currentDomain) {
    gitlabInput.value = currentDomain;
    gitlabStatus.textContent = `Active: ${currentDomain}`;
    gitlabStatus.className = 'hint success';
  }

  saveGitlab.addEventListener('click', async () => {
    const val = gitlabInput.value.trim();
    await setCustomGitLabDomain(val || null);
    gitlabStatus.textContent = val ? `Active: ${val}` : 'Cleared.';
    gitlabStatus.className = val ? 'hint success' : 'hint';
  });

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
}

init();
