// URL matchers and diff inspection for GitHub PRs and GitLab MRs
window.TFEPageDetector = {
  GITHUB_PR_RE: /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/,
  GITLAB_MR_RE: /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/,

  isGitHubPR(url) {
    return this.GITHUB_PR_RE.test(url || location.href);
  },

  isGitLabMR(url) {
    return this.GITLAB_MR_RE.test(url || location.href);
  },

  isSupportedPage(url) {
    return this.isGitHubPR(url) || this.isGitLabMR(url);
  },

  hasTerraformDiff() {
    // GitHub: data-path attributes on diff file headers
    const githubFiles = document.querySelectorAll(
      '[data-path$=".tf"], .file-header[data-path$=".tf"]'
    );
    if (githubFiles.length > 0) return true;

    // GitLab: file title elements in the diff view
    const gitlabFiles = document.querySelectorAll('.diff-file-changes .file-title-name');
    for (const el of gitlabFiles) {
      if (el.textContent.trim().endsWith('.tf')) return true;
    }
    return false;
  },

  // Returns the MutationObserver so the caller can disconnect it if needed
  watchForNavigation(callback) {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        callback(location.href);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  },
};
