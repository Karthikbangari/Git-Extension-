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

export function removeSidebar(): void {
  document.getElementById(SIDEBAR_ID)?.remove();
}
