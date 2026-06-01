import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { timeAgo, formatBytes, formatTokens, parseKeyToMeta } from '../src/dashboard/dashboard';

// ── timeAgo ──────────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const now = new Date('2026-06-01T12:00:00Z').getTime();

  it('returns "just now" for under 60 seconds', () => {
    expect(timeAgo(now - 30_000)).toBe('just now');
  });

  it('returns "1 min ago" for 90 seconds', () => {
    expect(timeAgo(now - 90_000)).toBe('1 min ago');
  });

  it('returns "5 min ago" for 5 minutes', () => {
    expect(timeAgo(now - 5 * 60_000)).toBe('5 min ago');
  });

  it('returns "1 hr ago" for 3700 seconds', () => {
    expect(timeAgo(now - 3_700_000)).toBe('1 hr ago');
  });

  it('returns "3 hr ago" for 3 hours', () => {
    expect(timeAgo(now - 3 * 3_600_000)).toBe('3 hr ago');
  });

  it('returns "1 day ago" for 25 hours', () => {
    expect(timeAgo(now - 25 * 3_600_000)).toBe('1 day ago');
  });

  it('returns "3 days ago" for 3 days', () => {
    expect(timeAgo(now - 3 * 86_400_000)).toBe('3 days ago');
  });
});

// ── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats bytes at exactly 1000', () => {
    expect(formatBytes(1000)).toBe('1.0 KB');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1500)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(2_100_000)).toBe('2.1 MB');
  });

  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });
});

// ── formatTokens ─────────────────────────────────────────────────────────────

describe('formatTokens', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokens(42)).toBe('42');
  });

  it('formats thousands with k suffix', () => {
    expect(formatTokens(1500)).toBe('1.5k');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokens(1_200_000)).toBe('1.2M');
  });
});

// ── parseKeyToMeta ───────────────────────────────────────────────────────────

describe('parseKeyToMeta', () => {
  it('extracts filename from a standard GitHub cache key', () => {
    const key = 'gfe_summary_facebook_react_main_src_hooks_useState.ts';
    const { filename } = parseKeyToMeta(key);
    expect(filename).toBe('useState.ts');
  });

  it('extracts repo hint (first two segments) from cache key', () => {
    const key = 'gfe_summary_facebook_react_main_src_hooks_useState.ts';
    const { repoHint } = parseKeyToMeta(key);
    expect(repoHint).toBe('facebook/react');
  });

  it('handles a single-segment path with extension', () => {
    const key = 'gfe_summary_octocat_hello_main_README.md';
    const { filename } = parseKeyToMeta(key);
    expect(filename).toBe('README.md');
  });

  it('falls back to full normalised key when no dot present', () => {
    const key = 'gfe_summary_owner_repo_main_Makefile';
    const { filename } = parseKeyToMeta(key);
    // no dot — falls back to full stripped key
    expect(filename).toBe('owner_repo_main_Makefile');
  });

  it('returns empty repoHint for a single-part key', () => {
    const key = 'gfe_summary_abc';
    const { repoHint } = parseKeyToMeta(key);
    expect(repoHint).toBe('');
  });
});
