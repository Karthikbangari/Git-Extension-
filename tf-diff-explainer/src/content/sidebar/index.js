// Sidebar shell — inject, remove, and collapse/expand
window.TFESidebar = {
  SIDEBAR_ID: 'tf-diff-explainer-sidebar',

  inject() {
    if (document.getElementById(this.SIDEBAR_ID)) return;

    const sidebar = document.createElement('div');
    sidebar.id = this.SIDEBAR_ID;
    sidebar.innerHTML = `
      <div class="tfe-header">
        <span class="tfe-title">TF Diff Explainer</span>
        <button class="tfe-toggle" aria-label="Collapse sidebar">&#x2715;</button>
      </div>
      <div class="tfe-body">
        <div class="tfe-skeleton">
          <div class="tfe-skeleton-line"></div>
          <div class="tfe-skeleton-line short"></div>
          <div class="tfe-skeleton-line"></div>
          <div class="tfe-skeleton-line short"></div>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    this._attachToggle(sidebar);
  },

  remove() {
    document.getElementById(this.SIDEBAR_ID)?.remove();
  },

  _attachToggle(sidebar) {
    const btn = sidebar.querySelector('.tfe-toggle');
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('tfe-collapsed');
      const collapsed = sidebar.classList.contains('tfe-collapsed');
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      btn.innerHTML = collapsed ? '&#x276F;' : '&#x2715;';
    });
  },
};
