import {
  getDashboardEntries,
  getTokenUsage,
  clearCache,
  getSummaryCacheBytesInUse,
} from '../utils/storage';
import type { DashboardEntry } from '../utils/storage';

// ── Pure utilities (exported for tests) ─────────────────────────────────────

export function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function parseKeyToMeta(cacheKey: string): { filename: string; repoHint: string } {
  // key format: gfe_summary_{owner}_{repo}_{branch}_{path_with_dots}
  const withoutPrefix = cacheKey.replace(/^gfe_summary_/, '');
  // last segment after final underscore that contains a dot is likely filename
  const parts = withoutPrefix.split('_');
  let filename = withoutPrefix;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].includes('.')) {
      filename = parts[i];
      break;
    }
  }
  // first two parts are likely owner + repo
  const repoHint = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
  return { filename, repoHint };
}

function filenameFromPath(filePath: string): string {
  if (!filePath) return '';
  return filePath.split('/').pop() ?? filePath;
}

function repoFromPath(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.split('/');
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : (parts[0] ?? '');
}

function subpathFromPath(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.split('/');
  if (parts.length <= 2) return '';
  return parts.slice(2, -1).join('/');
}

// ── Render ───────────────────────────────────────────────────────────────────

function renderStats(fileCount: number, tokenTotal: number, cacheBytes: number): void {
  const el = document.getElementById('stats-row') as HTMLElement;
  el.innerHTML = `
    <div class="gfe-stat-chip">
      <span class="gfe-stat-value">${fileCount}</span>
      <span class="gfe-stat-label">files explained</span>
    </div>
    <div class="gfe-stat-chip">
      <span class="gfe-stat-value">${formatTokens(tokenTotal)}</span>
      <span class="gfe-stat-label">tokens used</span>
    </div>
    <div class="gfe-stat-chip">
      <span class="gfe-stat-value">${formatBytes(cacheBytes)}</span>
      <span class="gfe-stat-label">cache</span>
    </div>
  `;
}

function renderFileCard(entry: DashboardEntry): string {
  const filePath = entry.filePath;
  const filename = filePath ? filenameFromPath(filePath) : parseKeyToMeta(entry.cacheKey).filename;
  const repo = filePath ? repoFromPath(filePath) : parseKeyToMeta(entry.cacheKey).repoHint;
  const subpath = filePath ? subpathFromPath(filePath) : '';
  const lang = entry.language !== 'Unknown' ? entry.language : '';
  const preview = entry.result.summary.slice(0, 80) + (entry.result.summary.length > 80 ? '…' : '');
  const ago = timeAgo(entry.ts);

  const repoLine = [repo, subpath ? `· ${subpath}/` : ''].filter(Boolean).join(' ');

  return `
    <div class="gfe-file-card">
      <div class="gfe-file-header">
        <span class="gfe-file-name">${escHtml(filename)}</span>
        ${lang ? `<span class="gfe-lang-badge">${escHtml(lang)}</span>` : ''}
        <span class="gfe-time-ago">● ${escHtml(ago)}</span>
      </div>
      ${repoLine ? `<div class="gfe-file-repo">${escHtml(repoLine)}</div>` : ''}
      <div class="gfe-file-preview">${escHtml(preview)}</div>
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <div class="gfe-empty">
      <span class="gfe-empty-icon">◈</span>
      <p class="gfe-empty-title">No files explained yet</p>
      <p class="gfe-empty-hint">Open a GitHub or GitLab file to get started.</p>
    </div>
  `;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function render(): Promise<void> {
  const [entries, usage, cacheBytes] = await Promise.all([
    getDashboardEntries(),
    getTokenUsage(),
    getSummaryCacheBytesInUse(),
  ]);

  renderStats(entries.length, usage.inputTokens + usage.outputTokens, cacheBytes);

  const list = document.getElementById('file-list') as HTMLElement;
  list.innerHTML = entries.length > 0 ? entries.map(renderFileCard).join('') : renderEmptyState();
}

async function init(): Promise<void> {
  await render();

  document.getElementById('clear-cache')?.addEventListener('click', async () => {
    await clearCache();
    await render();
  });
}

if (typeof globalThis.chrome !== 'undefined') {
  init();
}
