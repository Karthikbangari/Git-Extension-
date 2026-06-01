import type { FileSummaryResult } from '../types';
import { estimateTokens } from '../fileExtractor';

const SIDEBAR_ID = 'git-file-explainer-sidebar';
const FAB_ID = 'gfe-fab';

export interface CacheMeta {
  fromCache: boolean;
  ts?: number;
}

let _onRerun: (() => void) | null = null;

export function setRerunHandler(cb: () => void): void {
  _onRerun = cb;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── SVG helpers ──────────────────────────────────────────────────────────────

function svg(paths: string, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const SPARKLE_PATH = '<path d="M12 3l1.5 6.5H20l-5.5 4 2 6.5L12 17l-4.5 3 2-6.5L4 9.5h6.5z"/>';

const ICONS = {
  sparkle: svg(SPARKLE_PATH, 18),
  sparkleSm: svg(SPARKLE_PATH, 13),
  close: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  check: svg(
    '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'
  ),
  summary: svg(
    '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'
  ),
  files: svg(
    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'
  ),
  health: svg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  refresh: svg(
    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>'
  ),
  alert: svg(
    '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  ),
  bug: svg(
    '<path d="M8 3l-1 1c-1 1-1 2 0 3M16 3l1 1c1 1 1 2 0 3"/><path d="M6 8h12v8a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z"/><line x1="6" y1="13" x2="2" y2="13"/><line x1="22" y1="13" x2="18" y2="13"/><line x1="12" y1="20" x2="12" y2="23"/>'
  ),
  shield: svg('<path d="M12 2l9 4.5v5c0 4-2.5 8-9 10.5C5.5 19.5 3 15.5 3 11.5v-5L12 2z"/>'),
  flask: svg('<path d="M9 3h6M9 3v8l-4 8h14l-4-8V3"/><line x1="9" y1="11" x2="15" y2="11"/>'),
  layers: svg(
    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  ),
};

type TabId = 'summary' | 'files' | 'health';

function complexityScore(c: FileSummaryResult['complexity']): {
  score: number;
  color: string;
  label: string;
} {
  if (c === 'low') return { score: 90, color: 'var(--gfe-emerald)', label: 'LOW' };
  if (c === 'medium') return { score: 60, color: 'var(--gfe-gold)', label: 'MEDIUM' };
  return { score: 30, color: 'var(--gfe-danger)', label: 'HIGH' };
}

function buildScoreRing(score: number, color: string, size = 62): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'gfe-ring-wrap';

  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const c = size / 2;

  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(ns, 'svg');
  svgEl.setAttribute('width', String(size));
  svgEl.setAttribute('height', String(size));
  svgEl.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svgEl.style.transform = 'rotate(-90deg)';

  const track = document.createElementNS(ns, 'circle');
  track.setAttribute('cx', String(c));
  track.setAttribute('cy', String(c));
  track.setAttribute('r', String(r));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--gfe-canvas-2)');
  track.setAttribute('stroke-width', String(sw));

  const fill = document.createElementNS(ns, 'circle');
  fill.setAttribute('cx', String(c));
  fill.setAttribute('cy', String(c));
  fill.setAttribute('r', String(r));
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke', color);
  fill.setAttribute('stroke-width', String(sw));
  fill.setAttribute('stroke-linecap', 'round');
  fill.setAttribute('stroke-dasharray', circ.toFixed(1));
  fill.setAttribute('stroke-dashoffset', circ.toFixed(1));
  fill.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)';

  svgEl.appendChild(track);
  svgEl.appendChild(fill);

  const val = document.createElement('div');
  val.className = 'gfe-ring-val';
  val.style.color = color;
  val.textContent = String(score);

  wrap.appendChild(svgEl);
  wrap.appendChild(val);

  // Animate the ring fill after paint
  requestAnimationFrame(() => {
    fill.setAttribute('stroke-dashoffset', offset.toFixed(1));
  });

  return wrap;
}

// ── FAB ──────────────────────────────────────────────────────────────────────

function injectFab(): void {
  if (document.getElementById(FAB_ID)) return;

  const fab = document.createElement('button');
  fab.id = FAB_ID;
  fab.setAttribute('aria-label', 'Open Git File Explainer');
  fab.classList.add('gfe-fab-hidden');

  const ring = document.createElement('span');
  ring.className = 'gfe-fab-ring';

  const icon = document.createElement('span');
  icon.className = 'gfe-fab-icon';
  icon.innerHTML = svg(SPARKLE_PATH, 22);

  fab.appendChild(ring);
  fab.appendChild(icon);

  fab.addEventListener('click', () => {
    document.getElementById(SIDEBAR_ID)?.classList.remove('gfe-panel-closed');
    fab.classList.add('gfe-fab-hidden');
  });

  document.body.appendChild(fab);
}

// ── Tab switching helper ──────────────────────────────────────────────────────

function activateTab(panel: HTMLElement, tabId: TabId): void {
  panel.querySelectorAll('.gfe-pn-tab').forEach((t) => t.classList.remove('gfe-tab-on'));
  panel.querySelector<HTMLElement>(`[data-tab="${tabId}"]`)?.classList.add('gfe-tab-on');
  panel.querySelectorAll<HTMLElement>('.gfe-tabview').forEach((v) => {
    v.style.display = v.dataset.tabview === tabId ? '' : 'none';
  });
}

// ── Panel shell ──────────────────────────────────────────────────────────────

export function injectSidebar(filePath?: string, language?: string): void {
  injectFab();

  const existing = document.getElementById(SIDEBAR_ID);
  if (existing) {
    if (filePath) {
      const nameEl = existing.querySelector<HTMLElement>('.gfe-filename');
      if (nameEl) nameEl.textContent = filePath.split('/').pop() ?? filePath;
    }
    if (language) {
      const langEl = existing.querySelector<HTMLElement>('.gfe-lang-badge');
      if (langEl) langEl.textContent = language;
    }
    return;
  }

  const panel = document.createElement('div');
  panel.id = SIDEBAR_ID;

  // ── Header ──────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'gfe-pn-head';

  const mark = document.createElement('div');
  mark.className = 'gfe-pn-mark';
  mark.innerHTML = svg(SPARKLE_PATH, 18);

  const idBlock = document.createElement('div');
  idBlock.className = 'gfe-pn-id';

  const pnName = document.createElement('div');
  pnName.className = 'gfe-pn-name';
  pnName.textContent = 'Git File Explainer';

  const pnSub = document.createElement('div');
  pnSub.className = 'gfe-pn-sub';

  if (filePath) {
    const fname = document.createElement('span');
    fname.className = 'gfe-filename';
    fname.textContent = filePath.split('/').pop() ?? filePath;
    pnSub.appendChild(fname);
  }
  if (language) {
    const lang = document.createElement('span');
    lang.className = 'gfe-lang-badge';
    lang.textContent = language;
    pnSub.appendChild(lang);
  }

  idBlock.appendChild(pnName);
  idBlock.appendChild(pnSub);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'gfe-pn-x';
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.addEventListener('click', () => {
    panel.classList.add('gfe-panel-closed');
    document.getElementById(FAB_ID)?.classList.remove('gfe-fab-hidden');
  });

  head.appendChild(mark);
  head.appendChild(idBlock);
  head.appendChild(closeBtn);

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'gfe-pn-tabs';

  const tabDefs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: 'summary', label: 'Summary', icon: ICONS.summary },
    { id: 'files', label: 'Files', icon: ICONS.files },
    { id: 'health', label: 'Health', icon: ICONS.health },
  ];

  for (const def of tabDefs) {
    const tab = document.createElement('button');
    tab.className = `gfe-pn-tab${def.id === 'summary' ? ' gfe-tab-on' : ''}`;
    tab.dataset.tab = def.id;
    tab.setAttribute('aria-label', def.label);

    const ic = document.createElement('div');
    ic.className = 'gfe-pn-tab-ic';
    ic.innerHTML = def.icon;

    const lbl = document.createElement('span');
    lbl.textContent = def.label;

    tab.appendChild(ic);
    tab.appendChild(lbl);
    tab.addEventListener('click', () => activateTab(panel, def.id));
    tabBar.appendChild(tab);
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'gfe-pn-body';

  for (const def of tabDefs) {
    const view = document.createElement('div');
    view.className = 'gfe-tabview';
    view.dataset.tabview = def.id;
    if (def.id !== 'summary') view.style.display = 'none';
    body.appendChild(view);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const foot = document.createElement('div');
  foot.className = 'gfe-pn-foot';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'gfe-refresh-btn';
  refreshBtn.setAttribute('aria-label', 'Refresh analysis');

  const refreshIcon = document.createElement('span');
  refreshIcon.innerHTML = ICONS.refresh;
  refreshBtn.appendChild(refreshIcon);
  refreshBtn.appendChild(document.createTextNode('Refresh Analysis'));
  refreshBtn.addEventListener('click', () => _onRerun?.());
  foot.appendChild(refreshBtn);

  // ── Loading overlay ──────────────────────────────────────────────────────
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'gfe-pn-loading';

  const orbWrap = document.createElement('div');
  orbWrap.className = 'gfe-orb-wrap';

  const orb = document.createElement('div');
  orb.className = 'gfe-orb';
  orb.innerHTML = svg(SPARKLE_PATH, 26);

  const orbRing = document.createElement('div');
  orbRing.className = 'gfe-orb-ring';

  orbWrap.appendChild(orb);
  orbWrap.appendChild(orbRing);

  const ldH = document.createElement('div');
  ldH.className = 'gfe-ld-h';
  ldH.textContent = 'Analyzing file…';

  const ldSub = document.createElement('div');
  ldSub.className = 'gfe-ld-sub';
  ldSub.textContent = 'Reading content & mapping structure';

  loadingOverlay.appendChild(orbWrap);
  loadingOverlay.appendChild(ldH);
  loadingOverlay.appendChild(ldSub);

  panel.appendChild(head);
  panel.appendChild(tabBar);
  panel.appendChild(body);
  panel.appendChild(foot);
  panel.appendChild(loadingOverlay);

  document.body.appendChild(panel);
}

// ── Update sidebar ───────────────────────────────────────────────────────────

export function updateSidebar(
  state: FileSummaryResult | 'loading' | 'no-key' | 'no-content' | 'binary' | 'error',
  onAsk?: (question: string) => void,
  truncated?: boolean,
  originalLineCount?: number,
  cacheMeta?: CacheMeta,
  contentChars?: number
): void {
  const panel = document.getElementById(SIDEBAR_ID);
  if (!panel) return;

  const loadingOverlay = panel.querySelector<HTMLElement>('.gfe-pn-loading');
  const summaryView = panel.querySelector<HTMLElement>('[data-tabview="summary"]');
  const filesView = panel.querySelector<HTMLElement>('[data-tabview="files"]');
  const healthView = panel.querySelector<HTMLElement>('[data-tabview="health"]');

  if (!summaryView || !filesView || !healthView) return;

  summaryView.textContent = '';
  filesView.textContent = '';
  healthView.textContent = '';

  if (state === 'loading') {
    if (loadingOverlay) loadingOverlay.style.display = '';
    return;
  }
  if (loadingOverlay) loadingOverlay.style.display = 'none';

  // ── Error / binary / no-content ──────────────────────────────────────────
  if (state === 'binary' || state === 'no-content' || state === 'error') {
    const msg = document.createElement('p');
    msg.className = 'gfe-status-msg';
    msg.textContent =
      state === 'binary'
        ? 'Binary file — no text content to explain.'
        : state === 'no-content'
          ? 'Could not read file content from this page.'
          : 'Explanation failed. Check your API key in the extension popup, then reload.';
    summaryView.appendChild(msg);
    return;
  }

  // ── No-key ───────────────────────────────────────────────────────────────
  if (state === 'no-key') {
    summaryView.appendChild(buildNoKeyCard(contentChars, truncated, originalLineCount));
    return;
  }

  // ── FileSummaryResult ────────────────────────────────────────────────────
  const { score, color, label } = complexityScore(state.complexity);

  if (cacheMeta?.fromCache && cacheMeta.ts) {
    const badge = document.createElement('span');
    badge.className = 'gfe-cached-badge';
    badge.textContent = `● Cached ${relativeTime(cacheMeta.ts)}`;
    summaryView.appendChild(badge);
  }

  if (truncated && originalLineCount) {
    appendTruncatedNotice(summaryView, originalLineCount, contentChars);
  }

  // AI summary card
  const aiCard = document.createElement('div');
  aiCard.className = 'gfe-ai-card';

  const aiChip = document.createElement('div');
  aiChip.className = 'gfe-ai-chip';
  const chipIcon = document.createElement('span');
  chipIcon.innerHTML = ICONS.sparkleSm;
  aiChip.appendChild(chipIcon);
  aiChip.appendChild(document.createTextNode('SUMMARY'));

  const aiH = document.createElement('div');
  aiH.className = 'gfe-ai-h';
  aiH.textContent = 'What does this file do?';

  const aiBody = document.createElement('div');
  aiBody.className = 'gfe-ai-body';
  aiBody.textContent = state.summary;

  aiCard.appendChild(aiChip);
  aiCard.appendChild(aiH);
  aiCard.appendChild(aiBody);
  summaryView.appendChild(aiCard);

  // Key points card
  if (state.keyPoints.length > 0) {
    const kpCard = document.createElement('div');
    kpCard.className = 'gfe-card';

    const kpLabel = document.createElement('div');
    kpLabel.className = 'gfe-label';
    kpLabel.textContent = 'Key Points';

    const kpList = document.createElement('div');
    kpList.className = 'gfe-kp';

    for (const point of state.keyPoints) {
      const row = document.createElement('div');
      row.className = 'gfe-kp-row';

      const dot = document.createElement('div');
      dot.className = 'gfe-kp-dot';
      dot.innerHTML = ICONS.check;

      const text = document.createElement('span');
      text.textContent = point;

      row.appendChild(dot);
      row.appendChild(text);
      kpList.appendChild(row);
    }

    kpCard.appendChild(kpLabel);
    kpCard.appendChild(kpList);
    summaryView.appendChild(kpCard);
  }

  // How It Connects card
  const hasConn = (state.connections?.length ?? 0) > 0;
  if (hasConn || state.analogy) {
    const connCard = document.createElement('div');
    connCard.className = 'gfe-card';

    const connLabel = document.createElement('div');
    connLabel.className = 'gfe-label';
    connLabel.textContent = 'How It Connects';
    connCard.appendChild(connLabel);

    if (state.analogy) {
      const analogyEl = document.createElement('p');
      analogyEl.className = 'gfe-analogy';
      analogyEl.textContent = state.analogy;
      connCard.appendChild(analogyEl);
    }

    if (hasConn) {
      const connects = document.createElement('div');
      connects.className = 'gfe-connects';

      for (const conn of state.connections!) {
        const node = document.createElement('div');
        node.className = 'gfe-cnode';

        const ic = document.createElement('div');
        ic.className = 'gfe-cnode-ic';
        ic.innerHTML = ICONS.layers;

        const tt = document.createElement('div');
        tt.className = 'gfe-cnode-tt';
        tt.textContent = conn;

        node.appendChild(ic);
        node.appendChild(tt);
        connects.appendChild(node);
      }

      connCard.appendChild(connects);
    }

    summaryView.appendChild(connCard);
  }

  // Watch Out For card
  if ((state.watchOutFor?.length ?? 0) > 0) {
    const woCard = document.createElement('div');
    woCard.className = 'gfe-card';

    const woLabel = document.createElement('div');
    woLabel.className = 'gfe-label';
    woLabel.textContent = 'Watch Out For';

    const woList = document.createElement('ul');
    woList.className = 'gfe-watchout-list';

    for (const w of state.watchOutFor!) {
      const li = document.createElement('li');
      li.className = 'gfe-watchout-item';
      li.textContent = w;
      woList.appendChild(li);
    }

    woCard.appendChild(woLabel);
    woCard.appendChild(woList);
    summaryView.appendChild(woCard);
  }

  // At a Glance card
  {
    const glanceCard = document.createElement('div');
    glanceCard.className = 'gfe-card';

    const glanceLabel = document.createElement('div');
    glanceLabel.className = 'gfe-label';
    glanceLabel.textContent = 'At a Glance';

    const grid = document.createElement('div');
    grid.className = 'gfe-glance';

    const headerLang = panel.querySelector<HTMLElement>('.gfe-lang-badge')?.textContent ?? '';
    const glanceItems: Array<{ value: string; label: string }> = [
      { value: label, label: 'COMPLEXITY' },
      { value: headerLang || '—', label: 'LANGUAGE' },
    ];
    if (contentChars !== undefined) {
      glanceItems.push({
        value: `~${estimateTokens(contentChars).toLocaleString()}`,
        label: 'TOKENS',
      });
    }

    for (const item of glanceItems) {
      const cell = document.createElement('div');
      cell.className = 'gfe-glance-cell';

      const val = document.createElement('div');
      val.className = 'gfe-glance-val';
      val.textContent = item.value;

      const lbl = document.createElement('div');
      lbl.className = 'gfe-glance-lbl';
      lbl.textContent = item.label;

      cell.appendChild(val);
      cell.appendChild(lbl);
      grid.appendChild(cell);
    }

    glanceCard.appendChild(glanceLabel);
    glanceCard.appendChild(grid);
    summaryView.appendChild(glanceCard);
  }

  // ── Files tab ────────────────────────────────────────────────────────────
  const headerFilename = panel.querySelector<HTMLElement>('.gfe-filename')?.textContent ?? '';
  const headerLang = panel.querySelector<HTMLElement>('.gfe-lang-badge')?.textContent ?? '';

  if (headerFilename || headerLang) {
    const fileCard = document.createElement('div');
    fileCard.className = 'gfe-card';

    const fileLabel = document.createElement('div');
    fileLabel.className = 'gfe-label';
    fileLabel.textContent = 'Current File';

    const fileInfo = document.createElement('div');
    fileInfo.className = 'gfe-file-info';

    if (headerFilename) {
      const fn = document.createElement('div');
      fn.className = 'gfe-file-name';
      fn.textContent = headerFilename;
      fileInfo.appendChild(fn);
    }

    if (headerLang) {
      const langPill = document.createElement('span');
      langPill.className = 'gfe-lang-pill';
      langPill.textContent = headerLang;
      fileInfo.appendChild(langPill);
    }

    fileCard.appendChild(fileLabel);
    fileCard.appendChild(fileInfo);
    filesView.appendChild(fileCard);
  }

  filesView.appendChild(buildQuickActions(filesView, onAsk));
  filesView.appendChild(buildQASection(state, onAsk));

  // ── Health tab ───────────────────────────────────────────────────────────
  const healthCard = document.createElement('div');
  healthCard.className = 'gfe-card gfe-health-card';

  const healthLabel = document.createElement('div');
  healthLabel.className = 'gfe-label';
  healthLabel.textContent = 'File Complexity';

  const ringCell = document.createElement('div');
  ringCell.className = 'gfe-ring-cell';

  const ringEl = buildScoreRing(score, color);
  const ringCaption = document.createElement('div');
  ringCaption.className = 'gfe-ring-caption';
  ringCaption.style.color = color;
  ringCaption.textContent = label;

  ringCell.appendChild(ringEl);
  ringCell.appendChild(ringCaption);
  healthCard.appendChild(healthLabel);
  healthCard.appendChild(ringCell);
  healthView.appendChild(healthCard);
}

// ── No-key card ──────────────────────────────────────────────────────────────

function buildNoKeyCard(
  contentChars?: number,
  truncated?: boolean,
  originalLineCount?: number
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gfe-no-key-card';

  const markEl = document.createElement('div');
  markEl.className = 'gfe-no-key-mark';
  markEl.innerHTML = svg(SPARKLE_PATH, 22);

  const titleEl = document.createElement('p');
  titleEl.className = 'gfe-no-key-title';
  titleEl.textContent = 'Add an API key to explain files';

  const subEl = document.createElement('p');
  subEl.className = 'gfe-no-key-sub';
  subEl.textContent =
    'Click the extension icon to set up AI explanations with your Anthropic API key.';

  const ctaBtn = document.createElement('button');
  ctaBtn.className = 'gfe-cta-genius-btn';
  ctaBtn.setAttribute('aria-label', 'Open extension popup to set up AI');
  ctaBtn.textContent = 'Set up AI';

  card.appendChild(markEl);
  card.appendChild(titleEl);
  card.appendChild(subEl);
  card.appendChild(ctaBtn);

  if (truncated && originalLineCount) {
    const notice = document.createElement('p');
    notice.className = 'gfe-truncated-notice';
    let text = `⚠ File truncated — showing excerpt of ${originalLineCount.toLocaleString()} lines`;
    if (contentChars !== undefined) {
      text += ` (~${estimateTokens(contentChars).toLocaleString()} tokens sent)`;
    }
    notice.textContent = text;
    card.appendChild(notice);
  } else if (contentChars !== undefined) {
    const chip = document.createElement('span');
    chip.className = 'gfe-token-chip';
    chip.textContent = `~${estimateTokens(contentChars).toLocaleString()} tokens`;
    card.appendChild(chip);
  }

  return card;
}

// ── Quick actions ─────────────────────────────────────────────────────────────

function buildQuickActions(
  container: HTMLElement,
  onAsk?: (question: string) => void
): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'gfe-quick-actions';

  const actions: Array<{ label: string; iconHtml: string; iconClass: string; question?: string }> =
    [
      { label: 'Explain', iconHtml: ICONS.sparkleSm, iconClass: 'gfe-quick-icon-green' },
      {
        label: 'Find Bugs',
        iconHtml: ICONS.bug,
        iconClass: 'gfe-quick-icon-red',
        question: 'Find bugs and issues in this file',
      },
      {
        label: 'Security Scan',
        iconHtml: ICONS.shield,
        iconClass: 'gfe-quick-icon-yellow',
        question: 'Are there any security vulnerabilities in this file?',
      },
      {
        label: 'Generate Tests',
        iconHtml: ICONS.flask,
        iconClass: 'gfe-quick-icon-cyan',
        question: 'What tests should I write for this file?',
      },
    ];

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className = 'gfe-quick-btn';
    btn.setAttribute('aria-label', action.label);

    const iconEl = document.createElement('span');
    iconEl.className = `gfe-quick-icon ${action.iconClass}`;
    iconEl.innerHTML = action.iconHtml;
    btn.appendChild(iconEl);
    btn.appendChild(document.createTextNode(action.label));

    if (action.question) {
      btn.addEventListener('click', () => {
        const input = container.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
        if (input) {
          input.value = action.question!;
          input.focus();
          if (onAsk) container.querySelector<HTMLButtonElement>('.gfe-qa-btn')?.click();
        }
      });
    } else {
      btn.addEventListener('click', () => _onRerun?.());
    }

    grid.appendChild(btn);
  }

  return grid;
}

// ── Q&A section ───────────────────────────────────────────────────────────────

function buildQASection(state: FileSummaryResult, onAsk?: (question: string) => void): HTMLElement {
  const section = document.createElement('div');
  section.className = 'gfe-qa-section';

  const heading = document.createElement('p');
  heading.className = 'gfe-subheading';
  heading.textContent = 'Ask a Question';
  section.appendChild(heading);

  const suggestions = suggestedQuestions(state);
  if (suggestions.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'gfe-chips-row';
    for (const q of suggestions) {
      const chipBtn = document.createElement('button');
      chipBtn.className = 'gfe-question-chip';
      chipBtn.textContent = q;
      chipBtn.addEventListener('click', () => {
        qaInput.value = q;
      });
      chipsRow.appendChild(chipBtn);
    }
    section.appendChild(chipsRow);
  }

  const messagesArea = document.createElement('div');
  messagesArea.className = 'gfe-qa-messages';

  const aiMsg = document.createElement('div');
  aiMsg.className = 'gfe-ai-msg';
  aiMsg.style.display = 'none';

  const aiAvatar = document.createElement('div');
  aiAvatar.className = 'gfe-ai-avatar';
  aiAvatar.innerHTML = svg(SPARKLE_PATH.replace('currentColor', '#07120a'), 12);

  const answerDiv = document.createElement('div');
  answerDiv.className = 'gfe-qa-answer';

  aiMsg.appendChild(aiAvatar);
  aiMsg.appendChild(answerDiv);
  messagesArea.appendChild(aiMsg);
  section.appendChild(messagesArea);

  const inputRow = document.createElement('div');
  inputRow.className = 'gfe-qa-input-row';

  const qaInput = document.createElement('textarea');
  qaInput.className = 'gfe-qa-input';
  qaInput.setAttribute('aria-label', 'Ask a question about this file');
  qaInput.setAttribute('placeholder', 'What does this function do? How can I improve it?');
  qaInput.maxLength = 280;

  const qaBtn = document.createElement('button');
  qaBtn.className = 'gfe-qa-btn';
  qaBtn.textContent = 'Ask';
  qaBtn.setAttribute('aria-label', 'Submit question');

  inputRow.appendChild(qaInput);
  inputRow.appendChild(qaBtn);
  section.appendChild(inputRow);

  if (onAsk) {
    qaBtn.addEventListener('click', () => {
      const question = qaInput.value.trim();
      if (!question) return;
      qaBtn.disabled = true;

      const userMsg = document.createElement('div');
      userMsg.className = 'gfe-user-msg';
      const bubble = document.createElement('div');
      bubble.className = 'gfe-user-bubble';
      bubble.textContent = question;
      userMsg.appendChild(bubble);
      messagesArea.insertBefore(userMsg, aiMsg);

      aiMsg.style.display = 'flex';
      qaInput.value = '';
      onAsk(question);
    });
  }

  return section;
}

function suggestedQuestions(result: FileSummaryResult): string[] {
  const base = ['What does this file do?', 'How can I improve this?'];
  base.push(result.complexity === 'high' ? 'What are the riskiest parts?' : 'Are there any bugs?');
  return base;
}

// ── Notices ───────────────────────────────────────────────────────────────────

function appendTruncatedNotice(
  parent: HTMLElement,
  originalLineCount: number,
  contentChars?: number
): void {
  const notice = document.createElement('p');
  notice.className = 'gfe-truncated-notice';
  let text = `⚠ File truncated — showing excerpt of ${originalLineCount.toLocaleString()} lines`;
  if (contentChars !== undefined) {
    text += ` (~${estimateTokens(contentChars).toLocaleString()} tokens sent)`;
  }
  notice.textContent = text;
  parent.appendChild(notice);
}

// ── Q&A answer updates ────────────────────────────────────────────────────────

export function updateQAAnswer(state: string | 'loading' | 'error'): void {
  const container = document.querySelector<HTMLElement>(`#${SIDEBAR_ID} .gfe-qa-answer`);
  const btn = document.querySelector<HTMLButtonElement>(`#${SIDEBAR_ID} .gfe-qa-btn`);
  if (!container) return;

  const aiMsg = container.closest<HTMLElement>('.gfe-ai-msg');
  if (aiMsg) aiMsg.style.display = 'flex';

  container.textContent = '';

  if (state === 'loading') {
    const el = document.createElement('p');
    el.className = 'gfe-qa-thinking';
    el.textContent = 'Thinking…';
    container.appendChild(el);
    return;
  }

  if (btn) btn.disabled = false;

  if (state === 'error') {
    const el = document.createElement('p');
    el.className = 'gfe-qa-error-text';
    el.textContent = 'Could not get an answer. Please try again.';
    container.appendChild(el);
    return;
  }

  const el = document.createElement('p');
  el.className = 'gfe-qa-text';
  el.textContent = state;
  container.appendChild(el);
}

export function appendQAChunk(chunk: string): void {
  const container = document.querySelector<HTMLElement>(`#${SIDEBAR_ID} .gfe-qa-answer`);
  if (!container) return;
  let el = container.querySelector<HTMLElement>('.gfe-qa-text');
  if (!el) {
    el = document.createElement('p');
    el.className = 'gfe-qa-text';
    container.appendChild(el);
  }
  el.textContent = (el.textContent ?? '') + chunk;
}

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
  document.getElementById(FAB_ID)?.remove();
}
