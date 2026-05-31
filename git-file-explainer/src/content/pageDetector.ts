const GITHUB_FILE_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;
const GITLAB_FILE_RE = /^https:\/\/gitlab\.com\/.+\/-\/blob\//;

export function isGitHubFilePage(url = location.href): boolean {
  return GITHUB_FILE_RE.test(url);
}

export function isGitLabFilePage(url = location.href): boolean {
  if (GITLAB_FILE_RE.test(url)) return true;
  // Support custom GitLab domains stored in the extension
  return false;
}

export function isCustomGitLabFilePage(url = location.href, customDomain?: string | null): boolean {
  if (!customDomain) return false;
  const escaped = customDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^https?://${escaped}/.+/-/blob/`);
  return re.test(url);
}

export function isFilePage(url = location.href, customDomain?: string | null): boolean {
  return (
    isGitHubFilePage(url) || isGitLabFilePage(url) || isCustomGitLabFilePage(url, customDomain)
  );
}

export function watchForNavigation(callback: (url: string) => void): MutationObserver {
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      callback(location.href);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
