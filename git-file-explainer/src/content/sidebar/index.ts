import type { FileSummaryResult } from '../types';
import { estimateTokens } from '../fileExtractor';

const SIDEBAR_ID = 'git-file-explainer-sidebar';

export interface CacheMeta {
  fromCache: boolean;
  ts?: number;
}

type Audience = 'developer' | 'non-technical';
type ModeChangeHandler = (audience: Audience) => void;

let _onModeChange: ModeChangeHandler | null = null;
let _onRerun: (() => void) | null = null;

export function setModeChangeHandler(cb: ModeChangeHandler): void {
  _onModeChange = cb;
}

export function setRerunHandler(cb: () => void): void {
  _onRerun = cb;
}

export function setSidebarModeToggle(audience: Audience): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;
  const toggle = sidebar.querySelector<HTMLElement>('.gfe-mode-toggle');
  const devBtn = sidebar.querySelector<HTMLElement>('.gfe-mode-dev');
  const bizBtn = sidebar.querySelector<HTMLElement>('.gfe-mode-biz');
  if (!toggle || !devBtn || !bizBtn) return;
  if (audience === 'non-technical') {
    devBtn.classList.remove('gfe-mode-active');
    bizBtn.classList.add('gfe-mode-active');
    toggle.classList.add('gfe-mode-biz-active');
  } else {
    devBtn.classList.add('gfe-mode-active');
    bizBtn.classList.remove('gfe-mode-active');
    toggle.classList.remove('gfe-mode-biz-active');
  }
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
  sparkle: svg(SPARKLE_PATH),
  sparkleSm: svg(SPARKLE_PATH, 12),
  code: svg('<polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/>'),
  globe: svg(
    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
  ),
  chevron: svg('<polyline points="6 9 12 15 18 9"/>'),
  chevLeft: svg('<polyline points="15 18 9 12 15 6"/>'),
  chevRight: svg('<polyline points="9 18 15 12 9 6"/>'),
  check: svg(
    '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'
  ),
  share: svg(
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'
  ),
  alert: svg(
    '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  ),
  bug: svg(
    '<path d="M8 3l-1 1c-1 1-1 2 0 3M16 3l1 1c1 1 1 2 0 3"/><path d="M6 8h12v8a4 4 0 01-4 4h-4a4 4 0 01-4-4V8z"/><line x1="6" y1="13" x2="2" y2="13"/><line x1="22" y1="13" x2="18" y2="13"/><line x1="12" y1="20" x2="12" y2="23"/>'
  ),
  shield: svg('<path d="M12 2l9 4.5v5c0 4-2.5 8-9 10.5C5.5 19.5 3 15.5 3 11.5v-5L12 2z"/>'),
  flask: svg('<path d="M9 3h6M9 3v8l-4 8h14l-4-8V3"/><line x1="9" y1="11" x2="15" y2="11"/>'),
};

const complexityColors: Record<FileSummaryResult['complexity'], string> = {
  low: 'gfe-chip-low',
  medium: 'gfe-chip-medium',
  high: 'gfe-chip-high',
};

function complexityScore(c: FileSummaryResult['complexity']): { score: number; color: string } {
  if (c === 'low') return { score: 90, color: '#3fb950' };
  if (c === 'medium') return { score: 60, color: '#f2cc60' };
  return { score: 30, color: '#f85149' };
}

function scoreRingSvg(score: number, color: string): string {
  const r = 14,
    cx = 18,
    cy = 18,
    sw = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return `<svg width="36" height="36" viewBox="0 0 36 36" class="gfe-score-ring">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#21262d" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
      fill="${color}" font-size="9" font-weight="700">${score}</text>
  </svg>`;
}

// ── Accordion ────────────────────────────────────────────────────────────────

function makeAccordion(
  title: string,
  iconHtml: string,
  iconClass: string,
  open: boolean
): { container: HTMLElement; inner: HTMLElement } {
  const acc = document.createElement('div');
  acc.className = open ? 'gfe-acc gfe-acc-open' : 'gfe-acc';

  const head = document.createElement('button');
  head.className = 'gfe-acc-head';
  head.setAttribute('aria-expanded', String(open));

  const iconEl = document.createElement('span');
  iconEl.className = `gfe-acc-icon ${iconClass}`;
  iconEl.innerHTML = iconHtml;

  const titleEl = document.createElement('span');
  titleEl.className = 'gfe-acc-title';
  titleEl.textContent = title;

  const chevEl = document.createElement('span');
  chevEl.className = 'gfe-chev';
  chevEl.innerHTML = ICONS.chevron;

  head.appendChild(iconEl);
  head.appendChild(titleEl);
  head.appendChild(chevEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'gfe-acc-body';

  const inner = document.createElement('div');
  inner.className = 'gfe-acc-inner';
  bodyEl.appendChild(inner);

  acc.appendChild(head);
  acc.appendChild(bodyEl);

  head.addEventListener('click', () => {
    const isOpen = acc.classList.toggle('gfe-acc-open');
    head.setAttribute('aria-expanded', String(isOpen));
  });

  return { container: acc, inner };
}

function buildList(items: string[], itemClass = ''): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'gfe-list';
  for (const item of items) {
    const li = document.createElement('li');
    if (itemClass) li.className = itemClass;
    li.textContent = item;
    list.appendChild(li);
  }
  return list;
}

// ── Sidebar inject ───────────────────────────────────────────────────────────

export function injectSidebar(filePath?: string, language?: string): void {
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

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'gfe-header';

  const headerRow = document.createElement('div');
  headerRow.className = 'gfe-header-row';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'gfe-icon-btn gfe-collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
  collapseBtn.innerHTML = ICONS.chevLeft;

  const brand = document.createElement('div');
  brand.className = 'gfe-brand';

  const markEl = document.createElement('div');
  markEl.className = 'gfe-mark';
  markEl.innerHTML = svg(SPARKLE_PATH.replace('currentColor', '#07120a'), 14);

  const titleEl = document.createElement('span');
  titleEl.className = 'gfe-title';
  titleEl.textContent = 'Git File Explainer';

  brand.appendChild(markEl);
  brand.appendChild(titleEl);

  const chips = document.createElement('div');
  chips.className = 'gfe-header-chips';

  if (filePath) {
    const nameEl = document.createElement('span');
    nameEl.className = 'gfe-filename';
    nameEl.textContent = filePath.split('/').pop() ?? filePath;
    chips.appendChild(nameEl);
  }
  if (language) {
    const langEl = document.createElement('span');
    langEl.className = 'gfe-lang-badge';
    langEl.textContent = language;
    chips.appendChild(langEl);
  }

  const expandBtn = document.createElement('button');
  expandBtn.className = 'gfe-icon-btn gfe-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand sidebar');
  expandBtn.innerHTML = ICONS.chevRight;

  headerRow.appendChild(collapseBtn);
  headerRow.appendChild(brand);
  headerRow.appendChild(chips);
  headerRow.appendChild(expandBtn);
  header.appendChild(headerRow);

  // ── Mode toggle ──
  const modeToggle = buildModeToggle();

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'gfe-body';
  body.appendChild(modeToggle);
  appendSkeleton(body);

  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);

  collapseBtn.addEventListener('click', () => sidebar.classList.add('gfe-collapsed'));
  expandBtn.addEventListener('click', () => sidebar.classList.remove('gfe-collapsed'));
}

function buildModeToggle(): HTMLElement {
  const toggle = document.createElement('div');
  toggle.className = 'gfe-mode-toggle';

  const thumb = document.createElement('div');
  thumb.className = 'gfe-mode-thumb';

  const devBtn = document.createElement('button');
  devBtn.className = 'gfe-mode-btn gfe-mode-dev gfe-mode-active';
  devBtn.setAttribute('aria-label', 'Developer mode');
  devBtn.innerHTML = `${ICONS.code} Developer`;

  const bizBtn = document.createElement('button');
  bizBtn.className = 'gfe-mode-btn gfe-mode-biz';
  bizBtn.setAttribute('aria-label', 'Business mode');
  bizBtn.innerHTML = `${ICONS.globe} Business`;

  devBtn.addEventListener('click', () => {
    if (devBtn.classList.contains('gfe-mode-active')) return;
    devBtn.classList.add('gfe-mode-active');
    bizBtn.classList.remove('gfe-mode-active');
    toggle.classList.remove('gfe-mode-biz-active');
    _onModeChange?.('developer');
  });

  bizBtn.addEventListener('click', () => {
    if (bizBtn.classList.contains('gfe-mode-active')) return;
    bizBtn.classList.add('gfe-mode-active');
    devBtn.classList.remove('gfe-mode-active');
    toggle.classList.add('gfe-mode-biz-active');
    _onModeChange?.('non-technical');
  });

  toggle.appendChild(thumb);
  toggle.appendChild(devBtn);
  toggle.appendChild(bizBtn);
  return toggle;
}

function appendSkeleton(parent: HTMLElement): void {
  const skeleton = document.createElement('div');
  skeleton.className = 'gfe-skeleton';
  for (const short of [false, true, false, false, true]) {
    const line = document.createElement('div');
    line.className = short ? 'gfe-skeleton-line short' : 'gfe-skeleton-line';
    skeleton.appendChild(line);
  }
  parent.appendChild(skeleton);
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
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;

  const body = sidebar.querySelector<HTMLElement>('.gfe-body');
  if (!body) return;

  // Preserve the mode toggle across state changes
  const modeToggle = body.querySelector<HTMLElement>('.gfe-mode-toggle');
  body.textContent = '';
  if (modeToggle) body.appendChild(modeToggle);

  if (state === 'loading') {
    appendSkeleton(body);
    return;
  }

  if (state === 'binary') {
    const msg = document.createElement('p');
    msg.className = 'gfe-no-content';
    msg.textContent = 'Binary file — no text content to explain.';
    body.appendChild(msg);
    return;
  }

  if (state === 'no-key') {
    body.appendChild(buildNoKeyCard());
    if (truncated && originalLineCount) {
      appendTruncatedNotice(body, originalLineCount, contentChars);
    } else if (contentChars !== undefined) {
      const chip = document.createElement('span');
      chip.className = 'gfe-token-chip';
      chip.textContent = `~${estimateTokens(contentChars).toLocaleString()} tokens`;
      body.appendChild(chip);
    }
    return;
  }

  if (state === 'error') {
    const msg = document.createElement('p');
    msg.className = 'gfe-error';
    msg.textContent = 'Explanation failed. Check your API key in the extension popup, then reload.';
    body.appendChild(msg);
    return;
  }

  if (state === 'no-content') {
    const msg = document.createElement('p');
    msg.className = 'gfe-no-content';
    msg.textContent = 'Could not read file content from this page.';
    body.appendChild(msg);
    return;
  }

  // ── FileSummaryResult ──────────────────────────────────────────────────────

  if (truncated && originalLineCount) appendTruncatedNotice(body, originalLineCount, contentChars);

  if (cacheMeta?.fromCache && cacheMeta.ts) {
    const badge = document.createElement('span');
    badge.className = 'gfe-cached-badge';
    badge.textContent = `● Cached ${relativeTime(cacheMeta.ts)}`;
    body.appendChild(badge);
  }

  // File meta row (filename + language pill + score ring from header)
  const headerFilename = sidebar.querySelector<HTMLElement>('.gfe-filename')?.textContent ?? '';
  const headerLang = sidebar.querySelector<HTMLElement>('.gfe-lang-badge')?.textContent ?? '';
  if (headerFilename || headerLang) {
    const metaRow = document.createElement('div');
    metaRow.className = 'gfe-file-meta-row';
    if (headerFilename) {
      const fn = document.createElement('span');
      fn.className = 'gfe-filename-body';
      fn.textContent = headerFilename;
      metaRow.appendChild(fn);
    }
    if (headerLang) {
      const pill = document.createElement('span');
      pill.className = 'gfe-lang-pill gfe-lang-pill-green';
      pill.textContent = headerLang;
      metaRow.appendChild(pill);
    }
    const { score, color } = complexityScore(state.complexity);
    const ring = document.createElement('span');
    ring.innerHTML = scoreRingSvg(score, color);
    metaRow.appendChild(ring);
    body.appendChild(metaRow);
  }

  // ── Accordion: Summary ────────────────────────────────────────────────────
  const { container: sumAcc, inner: sumInner } = makeAccordion(
    'Summary',
    ICONS.sparkle,
    'gfe-acc-icon-green',
    true
  );
  const chip = document.createElement('span');
  chip.className = `gfe-chip ${complexityColors[state.complexity]}`;
  chip.textContent = `${state.complexity.toUpperCase()} COMPLEXITY`;
  sumInner.appendChild(chip);
  const summaryEl = document.createElement('p');
  summaryEl.className = 'gfe-summary';
  summaryEl.textContent = state.summary;
  sumInner.appendChild(summaryEl);
  body.appendChild(sumAcc);

  // ── Accordion: Key Points ─────────────────────────────────────────────────
  if (state.keyPoints.length > 0) {
    const { container: kpAcc, inner: kpInner } = makeAccordion(
      'Key Points',
      ICONS.check,
      'gfe-acc-icon-blue',
      false
    );
    kpInner.appendChild(buildList(state.keyPoints));
    body.appendChild(kpAcc);
  }

  // ── Accordion: How It Connects ────────────────────────────────────────────
  const hasConn = (state.connections?.length ?? 0) > 0;
  if (hasConn || state.analogy) {
    const { container: connAcc, inner: connInner } = makeAccordion(
      'How It Connects',
      ICONS.share,
      'gfe-acc-icon-purple',
      false
    );
    if (state.analogy) {
      const analogyEl = document.createElement('p');
      analogyEl.className = 'gfe-analogy';
      analogyEl.textContent = `💡 ${state.analogy}`;
      connInner.appendChild(analogyEl);
    }
    if (hasConn) connInner.appendChild(buildList(state.connections!));
    body.appendChild(connAcc);
  }

  // ── Accordion: Watch Out For ──────────────────────────────────────────────
  if ((state.watchOutFor?.length ?? 0) > 0) {
    const { container: woAcc, inner: woInner } = makeAccordion(
      'Watch Out For',
      ICONS.alert,
      'gfe-acc-icon-warn',
      false
    );
    woInner.appendChild(buildList(state.watchOutFor!, 'gfe-watchout-item'));
    body.appendChild(woAcc);
  }

  // ── Quick actions ─────────────────────────────────────────────────────────
  body.appendChild(buildQuickActions(body, onAsk));

  // ── Q&A section ───────────────────────────────────────────────────────────
  body.appendChild(buildQASection(state, onAsk));

  // ── Copy + Share ──────────────────────────────────────────────────────────
  appendCopyButtons(body, state);
  appendShareButton(body, state);
}

// ── No-key card ──────────────────────────────────────────────────────────────

function buildNoKeyCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gfe-no-key-card';

  const markEl = document.createElement('div');
  markEl.className = 'gfe-no-key-mark';
  markEl.innerHTML = svg(SPARKLE_PATH.replace('currentColor', '#07120a'), 22);

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
  return card;
}

// ── Quick actions ─────────────────────────────────────────────────────────────

function buildQuickActions(body: HTMLElement, onAsk?: (question: string) => void): HTMLElement {
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
        const input = body.querySelector<HTMLTextAreaElement>('.gfe-qa-input');
        if (input) {
          input.value = action.question!;
          input.focus();
          if (onAsk) {
            body.querySelector<HTMLButtonElement>('.gfe-qa-btn')?.click();
          }
        }
      });
    } else {
      // Explain button — re-run via stored handler
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

  // Suggestion chips
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

  // Messages area: user bubbles + AI response
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

  // Input row
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

      // Show user bubble
      const userMsg = document.createElement('div');
      userMsg.className = 'gfe-user-msg';
      const bubble = document.createElement('div');
      bubble.className = 'gfe-user-bubble';
      bubble.textContent = question;
      userMsg.appendChild(bubble);
      messagesArea.insertBefore(userMsg, aiMsg);

      // Reveal the AI response area
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

// ── Copy + share ──────────────────────────────────────────────────────────────

function appendCopyButtons(parent: HTMLElement, result: FileSummaryResult): void {
  const row = document.createElement('div');
  row.className = 'gfe-copy-row';

  const plainBtn = document.createElement('button');
  plainBtn.className = 'gfe-copy-btn';
  plainBtn.setAttribute('aria-label', 'Copy summary as plain text');
  plainBtn.textContent = 'Copy';
  plainBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(buildPlainText(result)).then(() => {
      plainBtn.textContent = 'Copied ✓';
      setTimeout(() => (plainBtn.textContent = 'Copy'), 1500);
    });
  });

  const mdBtn = document.createElement('button');
  mdBtn.className = 'gfe-copy-btn';
  mdBtn.setAttribute('aria-label', 'Copy summary as Markdown');
  mdBtn.textContent = 'Copy as Markdown';
  mdBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(buildMarkdown(result)).then(() => {
      mdBtn.textContent = 'Copied ✓';
      setTimeout(() => (mdBtn.textContent = 'Copy as Markdown'), 1500);
    });
  });

  row.appendChild(plainBtn);
  row.appendChild(mdBtn);
  parent.appendChild(row);
}

function buildPlainText(result: FileSummaryResult): string {
  const lines: string[] = [result.summary, ''];
  if (result.analogy) lines.push(result.analogy, '');
  if (result.keyPoints.length > 0) {
    lines.push('Key Points:');
    result.keyPoints.forEach((p) => lines.push(`  • ${p}`));
    lines.push('');
  }
  if ((result.connections?.length ?? 0) > 0) {
    lines.push('How It Connects:');
    result.connections!.forEach((c) => lines.push(`  • ${c}`));
    lines.push('');
  }
  if ((result.watchOutFor?.length ?? 0) > 0) {
    lines.push('Watch Out For:');
    result.watchOutFor!.forEach((w) => lines.push(`  • ${w}`));
  }
  return lines.join('\n').trim();
}

function buildMarkdown(result: FileSummaryResult): string {
  const lines: string[] = ['## Summary', '', result.summary, ''];
  if (result.analogy) lines.push(`> ${result.analogy}`, '');
  if (result.keyPoints.length > 0) {
    lines.push('## Key Points');
    result.keyPoints.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }
  if ((result.connections?.length ?? 0) > 0) {
    lines.push('## How It Connects');
    result.connections!.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
  }
  if ((result.watchOutFor?.length ?? 0) > 0) {
    lines.push('## Watch Out For');
    result.watchOutFor!.forEach((w) => lines.push(`- ${w}`));
  }
  return lines.join('\n').trim();
}

function buildClaudePrompt(result: FileSummaryResult, filePath: string, language: string): string {
  const lines: string[] = [];
  if (filePath) lines.push(`File: ${filePath}`);
  if (language) lines.push(`Language: ${language}`);
  lines.push('', 'Summary:', result.summary, '');
  if (result.keyPoints.length > 0) {
    lines.push('Key Points:');
    result.keyPoints.forEach((p) => lines.push(`• ${p}`));
    lines.push('');
  }
  lines.push('Ask me anything about this file.');
  return lines.join('\n').trim();
}

function showToast(): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;
  const existing = sidebar.querySelector('.gfe-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'gfe-toast';
  toast.textContent = 'Copied! Paste into Claude.ai ↗';
  sidebar.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function appendShareButton(parent: HTMLElement, result: FileSummaryResult): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  const filePath = sidebar?.querySelector<HTMLElement>('.gfe-filename')?.textContent ?? '';
  const language = sidebar?.querySelector<HTMLElement>('.gfe-lang-badge')?.textContent ?? '';

  const btn = document.createElement('button');
  btn.className = 'gfe-share-btn';
  btn.setAttribute('aria-label', 'Open in Claude.ai');
  btn.textContent = '↗ Open in Claude.ai';
  btn.addEventListener('click', () => {
    const prompt = buildClaudePrompt(result, filePath, language);
    void navigator.clipboard.writeText(prompt).then(() => {
      showToast();
      window.open('https://claude.ai', '_blank', 'noopener');
    });
  });
  parent.appendChild(btn);
}

// ── Q&A answer updates ────────────────────────────────────────────────────────

export function updateQAAnswer(state: string | 'loading' | 'error'): void {
  const container = document.querySelector<HTMLElement>(`#${SIDEBAR_ID} .gfe-qa-answer`);
  const btn = document.querySelector<HTMLButtonElement>(`#${SIDEBAR_ID} .gfe-qa-btn`);
  if (!container) return;

  // Reveal the AI message wrapper if it exists
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
}
