import { describe, it, expect } from 'vitest';
import { isGitHubFilePage, isGitLabFilePage, isFilePage } from '../src/content/pageDetector';

describe('isGitHubFilePage', () => {
  it('matches a GitHub blob URL', () => {
    expect(isGitHubFilePage('https://github.com/owner/repo/blob/main/src/index.ts')).toBe(true);
  });

  it('matches a deeply nested path', () => {
    expect(
      isGitHubFilePage('https://github.com/org/project/blob/feature-branch/a/b/c/file.py')
    ).toBe(true);
  });

  it('does not match a GitHub PR files page', () => {
    expect(isGitHubFilePage('https://github.com/owner/repo/pull/42/files')).toBe(false);
  });

  it('does not match a GitHub repo root', () => {
    expect(isGitHubFilePage('https://github.com/owner/repo')).toBe(false);
  });

  it('does not match a GitHub tree view', () => {
    expect(isGitHubFilePage('https://github.com/owner/repo/tree/main/src')).toBe(false);
  });

  it('does not match a non-GitHub URL', () => {
    expect(isGitHubFilePage('https://example.com/blob/main/file.ts')).toBe(false);
  });
});

describe('isGitLabFilePage', () => {
  it('matches a GitLab blob URL', () => {
    expect(isGitLabFilePage('https://gitlab.com/owner/repo/-/blob/main/src/main.go')).toBe(true);
  });

  it('matches a subgroup path', () => {
    expect(isGitLabFilePage('https://gitlab.com/group/subgroup/project/-/blob/main/Makefile')).toBe(
      true
    );
  });

  it('does not match a GitLab MR page', () => {
    expect(isGitLabFilePage('https://gitlab.com/owner/repo/-/merge_requests/7')).toBe(false);
  });

  it('does not match a GitLab repo root', () => {
    expect(isGitLabFilePage('https://gitlab.com/owner/repo')).toBe(false);
  });

  it('does not match a non-GitLab URL', () => {
    expect(isGitLabFilePage('https://example.com/-/blob/main/file.rb')).toBe(false);
  });
});

describe('isFilePage', () => {
  it('returns true for a GitHub file URL', () => {
    expect(isFilePage('https://github.com/owner/repo/blob/main/README.md')).toBe(true);
  });

  it('returns true for a GitLab file URL', () => {
    expect(isFilePage('https://gitlab.com/owner/repo/-/blob/main/README.md')).toBe(true);
  });

  it('returns false for a PR URL', () => {
    expect(isFilePage('https://github.com/owner/repo/pull/1/files')).toBe(false);
  });

  it('returns false for an unrelated URL', () => {
    expect(isFilePage('https://example.com')).toBe(false);
  });
});
