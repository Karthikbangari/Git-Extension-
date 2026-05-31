import type { FileSummaryResult } from '../types';

const SIDEBAR_ID = 'git-file-explainer-sidebar';

export interface CacheMeta {
  fromCache: boolean;
  ts?: number;
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function injectSidebar(filePath?: string, language?: string): void {
  const existing = document.getElementById(SIDEBAR_ID);
  if (existing) {
    // Update header if we have new info
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

  const header = document.createElement('div');
  header.className = 'gfe-header';

  const headerRow = document.createElement('div');
  headerRow.className = 'gfe-header-row';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'gfe-toggle gfe-collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
  collapseBtn.textContent = '‹';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'gfe-title-group';

  const title = document.createElement('span');
  title.className = 'gfe-title';
  title.textContent = 'Git File Explainer';
  titleGroup.appendChild(title);

  if (filePath || language) {
    const meta = document.createElement('div');
    meta.className = 'gfe-file-meta';

    if (filePath) {
      const nameEl = document.createElement('span');
      nameEl.className = 'gfe-filename';
      nameEl.textContent = filePath.split('/').pop() ?? filePath;
      meta.appendChild(nameEl);
    }
    if (language) {
      const langEl = document.createElement('span');
      langEl.className = 'gfe-lang-badge';
      langEl.textContent = language;
      meta.appendChild(langEl);
    }
    titleGroup.appendChild(meta);
  }

  const expandBtn = document.createElement('button');
  expandBtn.className = 'gfe-toggle gfe-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand sidebar');
  expandBtn.textContent = '›';

  headerRow.appendChild(collapseBtn);
  headerRow.appendChild(titleGroup);
  headerRow.appendChild(expandBtn);
  header.appendChild(headerRow);

  const body = document.createElement('div');
  body.className = 'gfe-body';

  appendSkeleton(body);

  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);

  collapseBtn.addEventListener('click', () => sidebar.classList.add('gfe-collapsed'));
  expandBtn.addEventListener('click', () => sidebar.classList.remove('gfe-collapsed'));
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

export function updateSidebar(
  state: FileSummaryResult | 'loading' | 'no-key' | 'no-content' | 'binary' | 'error',
  onAsk?: (question: string) => void,
  truncated?: boolean,
  originalLineCount?: number,
  cacheMeta?: CacheMeta
): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;

  const body = sidebar.querySelector<HTMLElement>('.gfe-body');
  if (!body) return;

  body.textContent = '';

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
    const msg = document.createElement('p');
    msg.className = 'gfe-cta';
    msg.textContent = 'Click the extension icon ↗ to set up AI explanations.';
    body.appendChild(msg);
    if (truncated && originalLineCount) appendTruncatedNotice(body, originalLineCount);
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

  // FileSummaryResult
  if (truncated && originalLineCount) appendTruncatedNotice(body, originalLineCount);

  if (cacheMeta?.fromCache && cacheMeta.ts) {
    const badge = document.createElement('span');
    badge.className = 'gfe-cached-badge';
    badge.textContent = `● Cached ${relativeTime(cacheMeta.ts)}`;
    body.appendChild(badge);
  }

  const complexityColors: Record<FileSummaryResult['complexity'], string> = {
    low: 'gfe-chip-low',
    medium: 'gfe-chip-medium',
    high: 'gfe-chip-high',
  };

  const chip = document.createElement('span');
  chip.className = `gfe-chip ${complexityColors[state.complexity]}`;
  chip.textContent = `${state.complexity.toUpperCase()} COMPLEXITY`;
  body.appendChild(chip);

  const summary = document.createElement('p');
  summary.className = 'gfe-summary';
  summary.textContent = state.summary;
  body.appendChild(summary);

  // Analogy (non-technical mode)
  if (state.analogy) {
    const analogyEl = document.createElement('p');
    analogyEl.className = 'gfe-analogy';
    analogyEl.textContent = `💡 ${state.analogy}`;
    body.appendChild(analogyEl);
  }

  if (state.keyPoints.length > 0) {
    appendSection(body, 'Key Points', state.keyPoints);
  }

  // How it connects (developer mode)
  if (state.connections && state.connections.length > 0) {
    appendSection(body, 'How It Connects', state.connections);
  }

  // Watch out for
  if (state.watchOutFor && state.watchOutFor.length > 0) {
    appendSection(body, 'Watch Out For', state.watchOutFor, 'gfe-watchout-item');
  }

  // Q&A section
  const sep = document.createElement('hr');
  sep.className = 'gfe-separator';
  body.appendChild(sep);

  const qaSection = document.createElement('div');
  qaSection.className = 'gfe-qa-section';

  const qaHeading = document.createElement('p');
  qaHeading.className = 'gfe-subheading';
  qaHeading.textContent = 'Ask a Question';
  qaSection.appendChild(qaHeading);

  // Suggested question chips
  const chips = suggestedQuestions(state);
  if (chips.length > 0) {
    const chipsRow = document.createElement('div');
    chipsRow.className = 'gfe-chips-row';
    for (const q of chips) {
      const btn = document.createElement('button');
      btn.className = 'gfe-question-chip';
      btn.textContent = q;
      btn.addEventListener('click', () => {
        qaInput.value = q;
      });
      chipsRow.appendChild(btn);
    }
    qaSection.appendChild(chipsRow);
  }

  const qaInput = document.createElement('textarea');
  qaInput.className = 'gfe-qa-input';
  qaInput.setAttribute('aria-label', 'Ask a question about this file');
  qaInput.setAttribute('placeholder', 'What does this function do? How can I improve it?');
  qaInput.maxLength = 280;
  qaSection.appendChild(qaInput);

  const qaBtn = document.createElement('button');
  qaBtn.className = 'gfe-qa-btn';
  qaBtn.textContent = 'Ask';
  qaBtn.setAttribute('aria-label', 'Submit question');
  qaSection.appendChild(qaBtn);

  const qaContainer = document.createElement('div');
  qaContainer.className = 'gfe-qa-answer';
  qaSection.appendChild(qaContainer);

  if (onAsk) {
    qaBtn.addEventListener('click', () => {
      const question = qaInput.value.trim();
      if (!question) return;
      qaBtn.disabled = true;
      onAsk(question);
    });
  }

  body.appendChild(qaSection);

  // Copy buttons
  appendCopyButtons(body, state);
}

function appendSection(
  parent: HTMLElement,
  heading: string,
  items: string[],
  itemClass = ''
): void {
  const h = document.createElement('p');
  h.className = 'gfe-subheading';
  h.textContent = heading;
  parent.appendChild(h);

  const list = document.createElement('ul');
  list.className = 'gfe-list';
  for (const item of items) {
    const li = document.createElement('li');
    if (itemClass) li.className = itemClass;
    li.textContent = item;
    list.appendChild(li);
  }
  parent.appendChild(list);
}

function appendTruncatedNotice(parent: HTMLElement, originalLineCount: number): void {
  const notice = document.createElement('p');
  notice.className = 'gfe-truncated-notice';
  notice.textContent = `⚠ File truncated — showing excerpt of ${originalLineCount.toLocaleString()} lines`;
  parent.appendChild(notice);
}

function suggestedQuestions(result: FileSummaryResult): string[] {
  const lang = '';
  void lang; // language context comes from sidebar state in future — for now use generic + complexity-based
  const base = ['What does this file do?', 'How can I improve this?'];
  if (result.complexity === 'high') base.push('What are the riskiest parts?');
  else base.push('Are there any bugs?');
  return base;
}

function appendCopyButtons(parent: HTMLElement, result: FileSummaryResult): void {
  const row = document.createElement('div');
  row.className = 'gfe-copy-row';

  const plainBtn = document.createElement('button');
  plainBtn.className = 'gfe-copy-btn';
  plainBtn.setAttribute('aria-label', 'Copy summary as plain text');
  plainBtn.textContent = 'Copy';
  plainBtn.addEventListener('click', () => {
    const text = buildPlainText(result);
    void navigator.clipboard.writeText(text).then(() => {
      plainBtn.textContent = 'Copied ✓';
      setTimeout(() => (plainBtn.textContent = 'Copy'), 1500);
    });
  });

  const mdBtn = document.createElement('button');
  mdBtn.className = 'gfe-copy-btn';
  mdBtn.setAttribute('aria-label', 'Copy summary as Markdown');
  mdBtn.textContent = 'Copy as Markdown';
  mdBtn.addEventListener('click', () => {
    const text = buildMarkdown(result);
    void navigator.clipboard.writeText(text).then(() => {
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
  if (result.connections && result.connections.length > 0) {
    lines.push('How It Connects:');
    result.connections.forEach((c) => lines.push(`  • ${c}`));
    lines.push('');
  }
  if (result.watchOutFor && result.watchOutFor.length > 0) {
    lines.push('Watch Out For:');
    result.watchOutFor.forEach((w) => lines.push(`  • ${w}`));
  }
  return lines.join('\n').trim();
}

function buildMarkdown(result: FileSummaryResult): string {
  const lines: string[] = [`## Summary`, '', result.summary, ''];
  if (result.analogy) lines.push(`> ${result.analogy}`, '');
  if (result.keyPoints.length > 0) {
    lines.push('## Key Points');
    result.keyPoints.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }
  if (result.connections && result.connections.length > 0) {
    lines.push('## How It Connects');
    result.connections.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
  }
  if (result.watchOutFor && result.watchOutFor.length > 0) {
    lines.push('## Watch Out For');
    result.watchOutFor.forEach((w) => lines.push(`- ${w}`));
  }
  return lines.join('\n').trim();
}

export function updateQAAnswer(state: string | 'loading' | 'error'): void {
  const container = document.querySelector<HTMLElement>(`#${SIDEBAR_ID} .gfe-qa-answer`);
  const btn = document.querySelector<HTMLButtonElement>(`#${SIDEBAR_ID} .gfe-qa-btn`);
  if (!container) return;

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
