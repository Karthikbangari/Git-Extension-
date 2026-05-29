// Entry point — orchestrates page detection, sidebar injection, and SPA navigation
(async function init() {
  const host = location.hostname;

  const enabled = await window.TFEStorage.isEnabledForHost(host);
  if (!enabled) return;

  if (!window.TFEPageDetector.isSupportedPage()) return;

  if (window.TFEPageDetector.hasTerraformDiff()) {
    window.TFESidebar.inject();
  }

  // GitHub uses Turbo/pjax; GitLab uses a Vue router — both mutate the DOM without a full reload
  window.TFEPageDetector.watchForNavigation(async (newUrl) => {
    window.TFESidebar.remove();

    if (!window.TFEPageDetector.isSupportedPage(newUrl)) return;

    const stillEnabled = await window.TFEStorage.isEnabledForHost(host);
    if (!stillEnabled) return;

    // Allow the SPA to finish rendering the new diff before inspecting
    setTimeout(() => {
      if (window.TFEPageDetector.hasTerraformDiff()) {
        window.TFESidebar.inject();
      }
    }, 500);
  });
})();
