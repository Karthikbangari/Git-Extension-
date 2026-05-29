import {
  isEnabledForHost,
  getCachedAnalysis,
  setCachedAnalysis,
  clearCachedAnalysis,
} from '../utils/storage';
import { isSupportedPage, hasTerraformDiff, watchForNavigation } from './pageDetector';
import { injectSidebar, updateSidebar, updateMinimap, removeSidebar } from './sidebar/index';
import { parseDiff } from './hunkParser';
import { classifyRisks } from './riskClassifier';
import { buildDependencyGraph } from './refParser';

(async function init() {
  const host = location.hostname;

  const runAnalysis = async () => {
    if (!hasTerraformDiff()) {
      await clearCachedAnalysis(location.href);
      return;
    }

    injectSidebar();

    const cached = await getCachedAnalysis(location.href);
    let changes, graph;

    if (cached) {
      ({ changes, graph } = cached);
    } else {
      changes = classifyRisks(await parseDiff());
      graph = buildDependencyGraph(changes);
      await setCachedAnalysis(location.href, changes, graph);
    }

    updateSidebar(changes);
    updateMinimap(changes, graph);
  };

  try {
    if (!isSupportedPage()) return;

    const enabled = await isEnabledForHost(host);
    if (!enabled) return;

    await runAnalysis();

    let navObserver: MutationObserver | null = null;

    // GitHub uses Turbo/pjax; GitLab uses Vue router — both mutate DOM without a full reload
    watchForNavigation(async (newUrl: string) => {
      removeSidebar();
      if (navObserver) navObserver.disconnect();

      if (!isSupportedPage(newUrl)) return;

      const stillEnabled = await isEnabledForHost(host);
      if (!stillEnabled) return;

      // Use MutationObserver to wait for the diff container to populate/stabilize
      navObserver = new MutationObserver((_, obs) => {
        if (hasTerraformDiff()) {
          obs.disconnect();
          runAnalysis();
        }
      });

      navObserver.observe(document.body, { childList: true, subtree: true });

      // Safety cleanup to prevent stale observers on pages without .tf changes
      setTimeout(() => navObserver?.disconnect(), 5000);
    });
  } catch {
    // Swallow silently — errors must not surface to the host PR page
  }
})();
