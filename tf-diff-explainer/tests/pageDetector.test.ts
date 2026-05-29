import { describe, it, expect } from 'vitest';

const GITHUB_PR_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const GITLAB_MR_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/;

function isGitHubPR(url: string): boolean {
  return GITHUB_PR_RE.test(url);
}
function isGitLabMR(url: string): boolean {
  return GITLAB_MR_RE.test(url);
}
function isSupportedPage(url: string): boolean {
  return isGitHubPR(url) || isGitLabMR(url);
}

describe('pageDetector', () => {
  describe('isGitHubPR', () => {
    it('matches a GitHub PR URL', () => {
      expect(isGitHubPR('https://github.com/org/repo/pull/123')).toBe(true);
    });
    it('matches a GitHub PR URL with /files suffix', () => {
      expect(isGitHubPR('https://github.com/org/repo/pull/123/files')).toBe(true);
    });
    it('does not match a GitHub issues URL', () => {
      expect(isGitHubPR('https://github.com/org/repo/issues/123')).toBe(false);
    });
    it('does not match a GitHub repo root', () => {
      expect(isGitHubPR('https://github.com/org/repo')).toBe(false);
    });
  });

  describe('isGitLabMR', () => {
    it('matches a GitLab MR URL', () => {
      expect(isGitLabMR('https://gitlab.com/org/repo/-/merge_requests/42')).toBe(true);
    });
    it('does not match a GitLab issues URL', () => {
      expect(isGitLabMR('https://gitlab.com/org/repo/-/issues/42')).toBe(false);
    });
  });

  describe('isSupportedPage', () => {
    it('returns true for a GitHub PR', () => {
      expect(isSupportedPage('https://github.com/org/repo/pull/1')).toBe(true);
    });
    it('returns true for a GitLab MR', () => {
      expect(isSupportedPage('https://gitlab.com/org/repo/-/merge_requests/1')).toBe(true);
    });
    it('returns false for an unrelated URL', () => {
      expect(isSupportedPage('https://example.com/')).toBe(false);
    });
  });
});
