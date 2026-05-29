import type { ResourceChange, DependencyGraph } from '../types';
import { renderMinimap } from './minimap';

const SIDEBAR_ID = 'tf-diff-explainer-sidebar';

let highlightController: AbortController | null = null;

function getRelated(activeId: string, graph: DependencyGraph): Set<string> {
  const related = new Set<string>();
  const deps = graph.get(activeId);
  if (deps) for (const d of deps) related.add(d);
  for (const [id, targets] of graph) {
    if (targets.has(activeId)) related.add(id);
  }
  return related;
}

function clearHighlight(sidebar: HTMLElement): void {
  delete sidebar.dataset.activeId;
  for (const el of sidebar.querySelectorAll(
    '.tfe-active, .tfe-related, .tfe-node-active, .tfe-node-related, .tfe-edge-active, .tfe-arrow-active'
  )) {
    el.classList.remove(
      'tfe-active',
      'tfe-related',
      'tfe-node-active',
      'tfe-node-related',
      'tfe-edge-active',
      'tfe-arrow-active'
    );
  }
}

function applyHighlight(sidebar: HTMLElement, activeId: string, graph: DependencyGraph): void {
  clearHighlight(sidebar);
  sidebar.dataset.activeId = activeId;
  const related = getRelated(activeId, graph);

  for (const card of sidebar.querySelectorAll<HTMLElement>('.tfe-card[data-resource-id]')) {
    const id = card.dataset.resourceId!;
    if (id === activeId) card.classList.add('tfe-active');
    else if (related.has(id)) card.classList.add('tfe-related');
  }

  for (const g of sidebar.querySelectorAll<Element>('g[data-id]')) {
    const id = g.getAttribute('data-id')!;
    if (id === activeId) g.classList.add('tfe-node-active');
    else if (related.has(id)) g.classList.add('tfe-node-related');
  }

  for (const edge of sidebar.querySelectorAll<Element>('line[data-from], polygon[data-from]')) {
    const from = edge.getAttribute('data-from')!;
    const to = edge.getAttribute('data-to')!;
    if (from === activeId || to === activeId) {
      const cls = edge.tagName === 'line' ? 'tfe-edge-active' : 'tfe-arrow-active';
      edge.classList.add(cls);
    }
  }
}

function setupHighlighting(sidebar: HTMLElement, body: HTMLElement, graph: DependencyGraph): void {
  highlightController?.abort();
  highlightController = new AbortController();
  const { signal } = highlightController;

  body.addEventListener(
    'mouseover',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>('.tfe-card[data-resource-id]');
      if (!card) return;
      const id = card.dataset.resourceId!;
      if (sidebar.dataset.activeId === id) return;
      applyHighlight(sidebar, id, graph);
    },
    { signal }
  );

  sidebar.addEventListener('mouseleave', () => clearHighlight(sidebar), { signal });
}

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
    card.dataset.resourceId = change.id;

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

export function updateMinimap(changes: ResourceChange[], graph: DependencyGraph): void {
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) return;

  const body = sidebar.querySelector<HTMLElement>('.tfe-body');
  if (!body) return;

  body.querySelector('.tfe-minimap-section')?.remove();

  if (changes.length === 0) return;

  const section = document.createElement('div');
  section.className = 'tfe-minimap-section';

  const heading = document.createElement('p');
  heading.className = 'tfe-minimap-heading';
  heading.textContent = 'Resource Graph';
  section.appendChild(heading);

  const svgNode = renderMinimap(changes, graph);
  if (Number(svgNode.getAttribute('height')) > 0) {
    section.appendChild(svgNode);
  }

  body.appendChild(section);
  setupHighlighting(sidebar, body, graph);
}

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}
