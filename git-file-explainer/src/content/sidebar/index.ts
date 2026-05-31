import type { FileSummaryResult } from '../types';

const SIDEBAR_ID = 'git-file-explainer-sidebar';

export function injectSidebar(): void {
  if (document.getElementById(SIDEBAR_ID)) return;

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;

  const header = document.createElement('div');
  header.className = 'gfe-header';

  const headerRow = document.createElement('div');
  headerRow.className = 'gfe-header-row';

  const title = document.createElement('span');
  title.className = 'gfe-title';
  title.textContent = 'Git File Explainer';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'gfe-toggle gfe-collapse-btn';
  collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
  collapseBtn.textContent = '‹';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'gfe-toggle gfe-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand sidebar');
  expandBtn.textContent = '›';

  headerRow.appendChild(collapseBtn);
  headerRow.appendChild(title);
  headerRow.appendChild(expandBtn);
  header.appendChild(headerRow);

  const body = document.createElement('div');
  body.className = 'gfe-body';

  const skeleton = document.createElement('div');
  skeleton.className = 'gfe-skeleton';
  for (const short of [false, true, false, false, true]) {
    const line = document.createElement('div');
    line.className = short ? 'gfe-skeleton-line short' : 'gfe-skeleton-line';
    skeleton.appendChild(line);
  }
  body.appendChild(skeleton);

  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);

  collapseBtn.addEventListener('click', () => sidebar.classList.add('gfe-collapsed'));
  expandBtn.addEventListener('click', () => sidebar.classList.remove('gfe-collapsed'));
}

export function updateSidebar(
  state: FileSummaryResult | 'loading' | 'no-key' | 'no-content' | 'error',
  onAsk?: (question: string) => void
): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;

  const body = sidebar.querySelector<HTMLElement>('.gfe-body');
  if (!body) return;

  body.textContent = '';

  if (state === 'loading') {
    const skeleton = document.createElement('div');
    skeleton.className = 'gfe-skeleton';
    for (const short of [false, true, false, false, true]) {
      const line = document.createElement('div');
      line.className = short ? 'gfe-skeleton-line short' : 'gfe-skeleton-line';
      skeleton.appendChild(line);
    }
    body.appendChild(skeleton);
    return;
  }

  if (state === 'no-key') {
    const msg = document.createElement('p');
    msg.className = 'gfe-cta';
    msg.textContent = 'Click the extension icon ↗ to set up AI explanations.';
    body.appendChild(msg);
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

  if (state.keyPoints.length > 0) {
    const heading = document.createElement('p');
    heading.className = 'gfe-subheading';
    heading.textContent = 'Key Points';
    body.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'gfe-list';
    for (const point of state.keyPoints) {
      const item = document.createElement('li');
      item.textContent = point;
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  // Q&A section — always rendered for FileSummaryResult
  const sep = document.createElement('hr');
  sep.className = 'gfe-separator';
  body.appendChild(sep);

  const qaSection = document.createElement('div');
  qaSection.className = 'gfe-qa-section';

  const qaHeading = document.createElement('p');
  qaHeading.className = 'gfe-subheading';
  qaHeading.textContent = 'Ask a Question';
  qaSection.appendChild(qaHeading);

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

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}
