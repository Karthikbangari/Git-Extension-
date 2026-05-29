import type { ResourceChange } from '../types';

const SIDEBAR_ID = 'tf-diff-explainer-sidebar';

export function injectSidebar(): void {
  if (document.getElementById(SIDEBAR_ID)) return;

  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;

  const header = document.createElement('div');
  header.className = 'tfe-header';

  const title = document.createElement('span');
  title.className = 'tfe-title';
  title.textContent = 'TF Diff Explainer';

  const btn = document.createElement('button');
  btn.className = 'tfe-toggle';
  btn.setAttribute('aria-label', 'Collapse sidebar');
  btn.textContent = '✕';

  header.appendChild(title);
  header.appendChild(btn);

  const body = document.createElement('div');
  body.className = 'tfe-body';

  const skeleton = document.createElement('div');
  skeleton.className = 'tfe-skeleton';
  for (const short of [false, true, false, true]) {
    const line = document.createElement('div');
    line.className = short ? 'tfe-skeleton-line short' : 'tfe-skeleton-line';
    skeleton.appendChild(line);
  }

  body.appendChild(skeleton);
  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);

  btn.addEventListener('click', () => {
    sidebar.classList.toggle('tfe-collapsed');
    const collapsed = sidebar.classList.contains('tfe-collapsed');
    btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    btn.textContent = collapsed ? '❯' : '✕';
  });
}

export function updateSidebar(results: ResourceChange[]): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;

  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!body) return;

  body.textContent = '';

  if (results.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'tfe-empty';
    empty.textContent = 'No Terraform changes detected.';
    body.appendChild(empty);
    return;
  }

  for (const change of results) {
    const card = document.createElement('div');
    card.className = `tfe-card tfe-risk-${change.riskProfile.level}`;

    const cardHeader = document.createElement('div');
    cardHeader.className = 'tfe-card-header';

    const cardTitle = document.createElement('span');
    cardTitle.className = 'tfe-card-title';
    cardTitle.textContent = change.id;

    const badge = document.createElement('span');
    badge.className = `tfe-card-badge tfe-risk-${change.riskProfile.level}`;
    badge.textContent = change.riskProfile.level.toUpperCase();

    cardHeader.appendChild(cardTitle);
    cardHeader.appendChild(badge);
    card.appendChild(cardHeader);

    if (change.riskProfile.reasons.length > 0) {
      const reasonList = document.createElement('ul');
      reasonList.className = 'tfe-card-reasons';
      for (const reason of change.riskProfile.reasons) {
        const item = document.createElement('li');
        item.className = 'tfe-card-reason';
        item.textContent = reason;
        reasonList.appendChild(item);
      }
      card.appendChild(reasonList);
    }

    body.appendChild(card);
  }
}

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}
