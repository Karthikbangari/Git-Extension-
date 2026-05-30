const GITHUB_FILE_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;
const GITLAB_FILE_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/blob\//;

export function isGitHubFilePage(url = location.href): boolean {
  return GITHUB_FILE_RE.test(url);
}

export function isGitLabFilePage(url = location.href): boolean {
  return GITLAB_FILE_RE.test(url);
}

export function isFilePage(url = location.href): boolean {
  return isGitHubFilePage(url) || isGitLabFilePage(url);
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
