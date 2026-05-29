// Unit tests for page detection logic — run with: node tests/pageDetector.test.js
const assert = require('assert');

const GITHUB_PR_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/;
const GITLAB_MR_RE = /^https:\/\/gitlab\.com\/[^/]+\/[^/]+\/-\/merge_requests\/\d+/;

function isGitHubPR(url) { return GITHUB_PR_RE.test(url); }
function isGitLabMR(url) { return GITLAB_MR_RE.test(url); }
function isSupportedPage(url) { return isGitHubPR(url) || isGitLabMR(url); }

const tests = [
  ['GitHub PR URL matches',
    () => assert.ok(isGitHubPR('https://github.com/org/repo/pull/123'))],
  ['GitHub PR URL with /files suffix matches',
    () => assert.ok(isGitHubPR('https://github.com/org/repo/pull/123/files'))],
  ['GitHub issues URL does not match',
    () => assert.ok(!isGitHubPR('https://github.com/org/repo/issues/123'))],
  ['GitHub repo root does not match',
    () => assert.ok(!isGitHubPR('https://github.com/org/repo'))],
  ['GitLab MR URL matches',
    () => assert.ok(isGitLabMR('https://gitlab.com/org/repo/-/merge_requests/42'))],
  ['GitLab issues URL does not match',
    () => assert.ok(!isGitLabMR('https://gitlab.com/org/repo/-/issues/42'))],
  ['isSupportedPage true for GitHub PR',
    () => assert.ok(isSupportedPage('https://github.com/org/repo/pull/1'))],
  ['isSupportedPage true for GitLab MR',
    () => assert.ok(isSupportedPage('https://gitlab.com/org/repo/-/merge_requests/1'))],
  ['isSupportedPage false for random URL',
    () => assert.ok(!isSupportedPage('https://example.com/'))],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
