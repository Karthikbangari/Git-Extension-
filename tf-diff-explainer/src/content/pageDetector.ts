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
  // Fast path: data-path attribute present (older GitHub, some GitLab)
  if (document.querySelector('[data-path$=".tf"], .file-header[data-path$=".tf"]')) return true;

  // Current GitHub: filename lives in a[title] or .Truncate-text inside .file-header
  for (const header of document.querySelectorAll('.file-header')) {
    if (header.querySelector('a[title$=".tf"]')) return true;
    const text = header.querySelector('.Truncate-text')?.textContent?.trim() ?? '';
    if (text.endsWith('.tf')) return true;
  }

  // GitLab
  for (const el of document.querySelectorAll('.diff-file-changes .file-title-name')) {
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
