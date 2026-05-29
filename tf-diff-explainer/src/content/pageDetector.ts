const GITHUB_PR_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const GITLAB_MR_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/;

export function isGitHubPR(url = location.href): boolean {
  return GITHUB_PR_RE.test(url);
}

export function isGitLabMR(url = location.href): boolean {
  return GITLAB_MR_RE.test(url);
}

export function isSupportedPage(url = location.href): boolean {
  return isGitHubPR(url) || isGitLabMR(url);
}

export function hasTerraformDiff(): boolean {
  const githubFiles = document.querySelectorAll(
    '[data-path$=".tf"], .file-header[data-path$=".tf"]'
  );
  if (githubFiles.length > 0) return true;

  const gitlabFiles = document.querySelectorAll('.diff-file-changes .file-title-name');
  for (const el of gitlabFiles) {
    if (el.textContent?.trim().endsWith('.tf')) return true;
  }
  return false;
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
