import {
  isEnabledForHost,
  getCachedAnalysis,
  setCachedAnalysis,
  clearCachedAnalysis,
  getApiKey,
  getCachedAISummary,
  setCachedAISummary,
} from '../utils/storage';
import { isSupportedPage, hasTerraformDiff, watchForNavigation } from './pageDetector';
import {
  injectSidebar,
  updateSidebar,
  updateMinimap,
  removeSidebar,
  updateAISummary,
} from './sidebar/index';
import { parseDiff } from './hunkParser';
import { classifyRisks } from './riskClassifier';
import { buildDependencyGraph } from './refParser';
import { fetchAISummary, generateDiffHash } from './aiSummary';

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

    // Phase 3: AI Summary Layer
    const apiKey = await getApiKey();
    if (!apiKey) {
      updateAISummary('no-key');
      return;
    }

    const hash = await generateDiffHash(changes);
    const cachedAI = await getCachedAISummary(hash);
    if (cachedAI) {
      updateAISummary(cachedAI);
      return;
    }

    updateAISummary('loading');
    const aiResult = await fetchAISummary(changes);
    if (aiResult) {
      try {
        await setCachedAISummary(hash, aiResult);
      } catch (error) {
        console.warn('TFE: Failed to cache AI summary', error);
      }
    }
    updateAISummary(aiResult ?? 'error');
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
