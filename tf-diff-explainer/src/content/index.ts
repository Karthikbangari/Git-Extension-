import { isEnabledForHost } from '../utils/storage';
import { isSupportedPage, hasTerraformDiff, watchForNavigation } from './pageDetector';
import { injectSidebar, removeSidebar } from './sidebar/index';

(async function init() {
  try {
    const host = location.hostname;

    if (!isSupportedPage()) return;

    const enabled = await isEnabledForHost(host);
    if (!enabled) return;

    if (hasTerraformDiff()) {
      injectSidebar();
    }

    // GitHub uses Turbo/pjax; GitLab uses Vue router — both mutate DOM without a full reload
    watchForNavigation(async (newUrl: string) => {
      removeSidebar();

      if (!isSupportedPage(newUrl)) return;

      const stillEnabled = await isEnabledForHost(host);
      if (!stillEnabled) return;

      // Allow the SPA to finish rendering before inspecting the new diff
      setTimeout(() => {
        if (hasTerraformDiff()) injectSidebar();
      }, 500);
    });
  } catch {
    // Swallow silently — errors must not surface to the host PR page
  }
})();
