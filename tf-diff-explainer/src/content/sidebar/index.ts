import type { ResourceChange, AISummaryResult, AttributeChange } from '../types';

const SIDEBAR_ID = 'tf-diff-explainer-sidebar';
const VERSION = '1.0.0';

const ACTION_LABELS: Record<string, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  replace: 'REPLACE',
};

export function injectSidebar(): void {
  if (document.getElementById(SIDEBAR_ID)) return;
  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  const header = document.createElement('div');
  header.className = 'tfe-header';
  const body = document.createElement('div');
  body.className = 'tfe-body';
  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);
}

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}

function getEls(): { sidebar: HTMLElement; header: HTMLElement; body: HTMLElement } | null {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return null;
  const header = sidebar.querySelector<HTMLElement>('.tfe-header');
  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!header || !body) return null;
  return { sidebar, header, body };
}

function buildCompactHeader(header: HTMLElement): void {
  header.className = 'tfe-header tfe-header-compact';
  header.textContent = '';

  const row = document.createElement('div');
  row.className = 'tfe-compact-row';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'tfe-compact-title';

  const icon = document.createElement('span');
  icon.className = 'tfe-compact-icon';
  icon.textContent = '◆';
  icon.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.textContent = 'TF Diff Explainer';

  titleWrap.appendChild(icon);
  titleWrap.appendChild(name);

  const expandBtn = document.createElement('button');
  expandBtn.className = 'tfe-toggle tfe-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand sidebar');
  expandBtn.textContent = '›';

  const sidebar = document.getElementById(SIDEBAR_ID);
  if (sidebar) {
    expandBtn.addEventListener('click', () => sidebar.classList.toggle('tfe-collapsed'));
  }

  row.appendChild(titleWrap);
  row.appendChild(expandBtn);

  const urlEl = document.createElement('p');
  urlEl.className = 'tfe-compact-url';
  const rawUrl = location.href.replace(/^https?:\/\//, '');
  urlEl.textContent = rawUrl.length > 55 ? rawUrl.slice(0, 54) + '…' : rawUrl;
  urlEl.title = location.href;

  header.appendChild(row);
  header.appendChild(urlEl);
}

function buildRiskBar(body: HTMLElement, changes: ResourceChange[]): void {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const c of changes) counts[c.riskProfile.level]++;
  const total = counts.high + counts.medium + counts.low || 1;

  const barWrap = document.createElement('div');
  barWrap.className = 'tfe-risk-bar-wrap';

  const bar = document.createElement('div');
  bar.className = 'tfe-risk-bar';
  if (counts.high) {
    const seg = document.createElement('span');
    seg.className = 'tfe-bar-seg tfe-bar-high';
    seg.style.width = `${(counts.high / total) * 100}%`;
    bar.appendChild(seg);
  }
  if (counts.medium) {
    const seg = document.createElement('span');
    seg.className = 'tfe-bar-seg tfe-bar-medium';
    seg.style.width = `${(counts.medium / total) * 100}%`;
    bar.appendChild(seg);
  }
  if (counts.low) {
    const seg = document.createElement('span');
    seg.className = 'tfe-bar-seg tfe-bar-low';
    seg.style.width = `${(counts.low / total) * 100}%`;
    bar.appendChild(seg);
  }
  barWrap.appendChild(bar);

  const chips = document.createElement('div');
  chips.className = 'tfe-risk-chips';
  const defs: Array<{ key: keyof typeof counts; cls: string }> = [
    { key: 'high', cls: 'tfe-chip-high' },
    { key: 'medium', cls: 'tfe-chip-medium' },
    { key: 'low', cls: 'tfe-chip-low' },
  ];
  for (const { key, cls } of defs) {
    if (!counts[key]) continue;
    const chip = document.createElement('span');
    chip.className = `tfe-risk-chip ${cls}`;
    chip.textContent = `${counts[key]} ${key}`;
    chips.appendChild(chip);
  }
  barWrap.appendChild(chips);
  body.appendChild(barWrap);
}

function truncateVal(s: string, max = 42): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function buildDiffLines(attrChanges: AttributeChange[]): string[] {
  const map = new Map<string, { old?: string; new?: string }>();
  for (const c of attrChanges) {
    if (c.isSensitive) continue;
    const entry = map.get(c.attribute) ?? {};
    if (c.oldValue !== undefined) entry.old = c.oldValue;
    if (c.newValue !== undefined) entry.new = c.newValue;
    map.set(c.attribute, entry);
  }
  const lines: string[] = [];
  for (const [attr, vals] of map) {
    if (vals.old !== undefined && vals.new !== undefined) {
      lines.push(`~ ${attr} = ${truncateVal(vals.old)} → ${truncateVal(vals.new)}`);
    } else if (vals.new !== undefined) {
      lines.push(`+ ${attr} = ${truncateVal(vals.new)}`);
    } else if (vals.old !== undefined) {
      lines.push(`- ${attr} = ${truncateVal(vals.old)}`);
    }
  }
  return lines.slice(0, 5);
}

function buildCard(change: ResourceChange): HTMLElement {
  const card = document.createElement('div');
  card.className = `tfe-card tfe-risk-${change.riskProfile.level}`;
  card.dataset.resourceId = change.id;

  const cardHeader = document.createElement('div');
  cardHeader.className = 'tfe-card-header';

  const info = document.createElement('div');
  info.className = 'tfe-card-info';

  const typeEl = document.createElement('span');
  typeEl.className = 'tfe-card-type';
  typeEl.textContent = change.type === 'unknown' ? '' : change.type;

  const nameEl = document.createElement('span');
  nameEl.className = 'tfe-card-name';
  nameEl.textContent = change.name;

  const fileEl = document.createElement('span');
  fileEl.className = 'tfe-card-file';
  fileEl.textContent = change.filePath;

  info.appendChild(typeEl);
  info.appendChild(nameEl);
  if (change.type !== 'unknown') info.appendChild(fileEl);

  const actionLabel = ACTION_LABELS[change.action];
  if (actionLabel) {
    const badge = document.createElement('span');
    badge.className = `tfe-action-badge tfe-action-${change.action}`;
    badge.textContent = actionLabel;
    cardHeader.appendChild(info);
    cardHeader.appendChild(badge);
  } else {
    cardHeader.appendChild(info);
  }

  card.appendChild(cardHeader);

  const diffLines = buildDiffLines(change.changes);
  if (diffLines.length > 0) {
    const diffEl = document.createElement('div');
    diffEl.className = 'tfe-diff-lines';
    for (const line of diffLines) {
      const lineEl = document.createElement('div');
      const prefix = line[0];
      lineEl.className =
        prefix === '~'
          ? 'tfe-diff-line tfe-diff-update'
          : prefix === '+'
            ? 'tfe-diff-line tfe-diff-add'
            : 'tfe-diff-line tfe-diff-delete';
      lineEl.textContent = line;
      diffEl.appendChild(lineEl);
    }
    card.appendChild(diffEl);
  }

  if (change.riskProfile.reasons.length > 0) {
    const reasons = document.createElement('div');
    reasons.className = 'tfe-card-reasons-list';
    for (const r of change.riskProfile.reasons) {
      const p = document.createElement('p');
      p.className = 'tfe-card-reason-text';
      p.textContent = r;
      reasons.appendChild(p);
    }
    card.appendChild(reasons);
  }

  return card;
}

// ── Step 2: Setup panel ────────────────────────────────────────────────────

export function showSetupPanel(
  host: string,
  onSave: (key: string) => Promise<void>,
  onToggle: (enabled: boolean) => Promise<void>,
  currentKey: string | null,
  siteEnabled: boolean
): void {
  const els = getEls();
  if (!els) return;
  const { header, body } = els;

  header.className = 'tfe-header tfe-header-full';
  header.textContent = '';
  const row = document.createElement('div');
  row.className = 'tfe-header-row';
  const title = document.createElement('span');
  title.className = 'tfe-title';
  title.textContent = 'TF Diff Explainer';
  const ver = document.createElement('span');
  ver.className = 'tfe-version';
  ver.textContent = `v${VERSION}`;
  row.appendChild(title);
  row.appendChild(ver);
  header.appendChild(row);

  body.textContent = '';

  if (!currentKey) {
    const banner = document.createElement('div');
    banner.className = 'tfe-setup-banner';
    const bannerTitle = document.createElement('p');
    bannerTitle.className = 'tfe-setup-banner-title';
    bannerTitle.textContent = '✦ Set up AI summaries';
    const steps = document.createElement('ol');
    steps.className = 'tfe-setup-steps';
    const s1 = document.createElement('li');
    const link = document.createElement('a');
    link.href = 'https://console.anthropic.com';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'console.anthropic.com ↗';
    s1.append('Get a free API key at ', link);
    const s2 = document.createElement('li');
    s2.textContent = 'Paste it below and click Save';
    steps.appendChild(s1);
    steps.appendChild(s2);
    banner.appendChild(bannerTitle);
    banner.appendChild(steps);
    body.appendChild(banner);
  }

  const keySection = document.createElement('div');
  keySection.className = 'tfe-setup-field';
  const keyLabel = document.createElement('label');
  keyLabel.htmlFor = 'tfe-setup-api-key';
  keyLabel.textContent = 'Anthropic API Key';
  const keyRow = document.createElement('div');
  keyRow.className = 'tfe-setup-input-row';
  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.id = 'tfe-setup-api-key';
  keyInput.className = 'tfe-setup-key-input';
  keyInput.placeholder = 'sk-ant-...';
  keyInput.autocomplete = 'off';
  keyInput.spellcheck = false;
  if (currentKey) keyInput.value = currentKey;
  const saveBtn = document.createElement('button');
  saveBtn.className = 'tfe-setup-save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.setAttribute('aria-label', 'Save API key');
  const keyStatus = document.createElement('p');
  keyStatus.className = 'tfe-setup-hint';
  if (currentKey) {
    keyStatus.textContent = 'Key saved ✓';
    keyStatus.classList.add('tfe-setup-hint-success');
  }
  saveBtn.addEventListener('click', async () => {
    const val = keyInput.value.trim();
    if (!val) return;
    await onSave(val);
    keyStatus.textContent = 'Key saved ✓';
    keyStatus.className = 'tfe-setup-hint tfe-setup-hint-success';
  });
  keyRow.appendChild(keyInput);
  keyRow.appendChild(saveBtn);
  keySection.appendChild(keyLabel);
  keySection.appendChild(keyRow);
  keySection.appendChild(keyStatus);
  body.appendChild(keySection);

  const toggleSection = document.createElement('div');
  toggleSection.className = 'tfe-setup-field';
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'tfe-setup-toggle-label';
  toggleLabel.htmlFor = 'tfe-setup-site-toggle';
  const toggleText = document.createElement('span');
  toggleText.textContent = 'Enable on this site';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'tfe-setup-site-toggle';
  toggleInput.className = 'tfe-setup-toggle-input';
  toggleInput.checked = siteEnabled;
  const toggleSwitch = document.createElement('span');
  toggleSwitch.className = 'tfe-setup-toggle-switch';
  toggleLabel.appendChild(toggleText);
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleSwitch);
  toggleInput.addEventListener('change', () => onToggle(toggleInput.checked));
  const hostHint = document.createElement('p');
  hostHint.className = 'tfe-setup-hint';
  hostHint.textContent = host;
  toggleSection.appendChild(toggleLabel);
  toggleSection.appendChild(hostHint);
  body.appendChild(toggleSection);

  const statusDot = document.createElement('p');
  statusDot.className = 'tfe-setup-status';
  statusDot.textContent = 'Active on GitHub & GitLab diffs';
  body.appendChild(statusDot);
}

// ── Step 3: Analyzing ─────────────────────────────────────────────────────

export function showAnalyzing(): void {
  const els = getEls();
  if (!els) return;
  const { header, body } = els;

  buildCompactHeader(header);

  body.textContent = '';
  const label = document.createElement('p');
  label.className = 'tfe-analyzing-label';
  label.textContent = 'ANALYZING PLAN…';
  body.appendChild(label);

  const skeletonWrap = document.createElement('div');
  skeletonWrap.className = 'tfe-skeleton';
  for (let i = 0; i < 3; i++) {
    const line = document.createElement('div');
    line.className = 'tfe-skeleton-line';
    skeletonWrap.appendChild(line);
  }
  body.appendChild(skeletonWrap);
}

// ── Step 4: Risk map ──────────────────────────────────────────────────────

export function showRiskMap(changes: ResourceChange[]): void {
  const els = getEls();
  if (!els) return;
  const { header, body } = els;

  buildCompactHeader(header);
  body.textContent = '';

  if (changes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tfe-empty';
    empty.textContent = 'No supported changes detected.';
    body.appendChild(empty);
    return;
  }

  buildRiskBar(body, changes);

  const sectionRow = document.createElement('div');
  sectionRow.className = 'tfe-section-row';
  const sectionLabel = document.createElement('span');
  sectionLabel.className = 'tfe-section-label';
  sectionLabel.textContent = 'RISK ANALYSIS';
  const sectionCount = document.createElement('span');
  sectionCount.className = 'tfe-section-count';
  sectionCount.textContent = `${changes.length} of ${changes.length}`;
  sectionRow.appendChild(sectionLabel);
  sectionRow.appendChild(sectionCount);
  body.appendChild(sectionRow);

  for (const change of changes) {
    body.appendChild(buildCard(change));
  }
}

// ── Step 5: AI review ─────────────────────────────────────────────────────

function inferLevel(riskText: string, changes: ResourceChange[]): 'high' | 'medium' | 'low' {
  const lower = riskText.toLowerCase();
  if (/^\[high\]/i.test(riskText)) return 'high';
  if (/^\[medium\]/i.test(riskText)) return 'medium';
  if (/^\[low\]/i.test(riskText)) return 'low';
  for (const c of changes) {
    if (lower.includes(c.name.toLowerCase()) || lower.includes(c.id.toLowerCase())) {
      return c.riskProfile.level;
    }
  }
  return 'medium';
}

export function showAIReview(
  changes: ResourceChange[],
  state: AISummaryResult | 'loading' | 'no-key' | 'error'
): void {
  const els = getEls();
  if (!els) return;
  const { header, body } = els;

  buildCompactHeader(header);
  body.textContent = '';

  if (changes.length > 0) buildRiskBar(body, changes);

  const sectionRow = document.createElement('div');
  sectionRow.className = 'tfe-section-row';
  const sectionLabel = document.createElement('span');
  sectionLabel.className = 'tfe-section-label';
  sectionLabel.textContent = 'AI REVIEW';
  const modelBadge = document.createElement('span');
  modelBadge.className = 'tfe-model-badge';
  modelBadge.textContent = 'claude haiku';
  sectionRow.appendChild(sectionLabel);
  sectionRow.appendChild(modelBadge);
  body.appendChild(sectionRow);

  if (state === 'loading') {
    const skeleton = document.createElement('div');
    skeleton.className = 'tfe-skeleton';
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('div');
      line.className = i === 2 ? 'tfe-skeleton-line short' : 'tfe-skeleton-line';
      skeleton.appendChild(line);
    }
    body.appendChild(skeleton);
    return;
  }

  if (state === 'no-key') {
    const msg = document.createElement('p');
    msg.className = 'tfe-ai-cta';
    msg.textContent = 'Add an API key in the extension popup or go back to Set up.';
    body.appendChild(msg);
    return;
  }

  if (state === 'error') {
    const msg = document.createElement('p');
    msg.className = 'tfe-ai-error';
    msg.textContent = 'AI review failed. Check your API key and reload.';
    body.appendChild(msg);
    return;
  }

  const summaryLabel = document.createElement('p');
  summaryLabel.className = 'tfe-ai-subheading';
  summaryLabel.textContent = 'Summary';
  body.appendChild(summaryLabel);

  const summaryText = document.createElement('p');
  summaryText.className = 'tfe-ai-summary';
  summaryText.textContent = state.summary;
  body.appendChild(summaryText);

  if (state.risks.length > 0) {
    const risksLabel = document.createElement('p');
    risksLabel.className = 'tfe-ai-subheading';
    risksLabel.textContent = 'Top risks';
    body.appendChild(risksLabel);

    for (const risk of state.risks) {
      const item = document.createElement('div');
      item.className = 'tfe-risk-item';
      const level = inferLevel(risk, changes);
      const badge = document.createElement('span');
      badge.className = `tfe-risk-badge tfe-risk-badge-${level}`;
      badge.textContent = level.toUpperCase();
      const cleanText = risk.replace(/^\[(HIGH|MEDIUM|LOW)\]\s*/i, '');
      const text = document.createElement('span');
      text.className = 'tfe-risk-item-text';
      text.textContent = cleanText;
      item.appendChild(badge);
      item.appendChild(text);
      body.appendChild(item);
    }
  }

  if (state.rollback.length > 0) {
    const rollbackLabel = document.createElement('p');
    rollbackLabel.className = 'tfe-ai-subheading';
    rollbackLabel.textContent = 'Rollback plan';
    body.appendChild(rollbackLabel);

    const list = document.createElement('ol');
    list.className = 'tfe-ai-rollback';
    list.setAttribute('aria-label', 'Rollback checklist');
    for (const step of state.rollback) {
      const item = document.createElement('li');
      item.className = 'tfe-ai-rollback-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'tfe-ai-rollback-check';
      checkbox.setAttribute('aria-label', 'Mark step complete');
      const text = document.createElement('span');
      text.textContent = step;
      item.appendChild(checkbox);
      item.appendChild(text);
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  if (state.prDescription) {
    const prLabel = document.createElement('p');
    prLabel.className = 'tfe-ai-subheading';
    prLabel.textContent = 'PR description';
    body.appendChild(prLabel);

    const prHeader = document.createElement('div');
    prHeader.className = 'tfe-ai-pr-header';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'tfe-ai-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy PR description');
    const prDescText = state.prDescription;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard
        .writeText(prDescText)
        .then(() => {
          copyBtn.textContent = 'Copied ✓';
          setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
        })
        .catch(() => {});
    });
    prHeader.appendChild(copyBtn);
    body.appendChild(prHeader);

    const pre = document.createElement('pre');
    pre.className = 'tfe-ai-pr-desc';
    pre.textContent = state.prDescription;
    body.appendChild(pre);
  }
}
