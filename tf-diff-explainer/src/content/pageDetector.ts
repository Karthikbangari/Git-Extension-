const GITHUB_PR_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const GITLAB_MR_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/;

export const SUPPORTED_EXTENSIONS = [
  '.tf',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.java',
  '.go',
  '.php',
  '.rb',
  '.cs',
  '.cpp',
  '.c',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.sql',
  '.html',
  '.css',
  '.scss',
  '.md',
];

function hasMatchingExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

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
  const dataPathSelector = SUPPORTED_EXTENSIONS.flatMap((ext) => [
    `[data-path$="${ext}"]`,
    `.file-header[data-path$="${ext}"]`,
  ]).join(', ');
  if (document.querySelector(dataPathSelector)) return true;

  // Current GitHub: filename lives in a[title] or .Truncate-text inside .file-header
  const titleSelector = SUPPORTED_EXTENSIONS.map((ext) => `a[title$="${ext}"]`).join(', ');
  for (const header of document.querySelectorAll('.file-header')) {
    if (header.querySelector(titleSelector)) return true;
    const text = header.querySelector('.Truncate-text')?.textContent?.trim() ?? '';
    if (hasMatchingExtension(text)) return true;
  }

  // GitLab
  for (const el of document.querySelectorAll('.diff-file-changes .file-title-name')) {
    if (hasMatchingExtension(el.textContent?.trim() ?? '')) return true;
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
