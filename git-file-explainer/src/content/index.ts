import { isFilePage, isGitHubFilePage, watchForNavigation } from './pageDetector';
import { GitHubDomExtractor, GitLabDomExtractor } from './fileExtractor';
import { injectSidebar, updateSidebar, removeSidebar } from './sidebar/index';
import { isEnabledForHost, getApiKey } from '../utils/storage';

(async function init() {
  const host = location.hostname;

  const run = async () => {
    injectSidebar();

    const apiKey = await getApiKey();
    if (!apiKey) {
      updateSidebar('no-key');
      return;
    }

    updateSidebar('loading');

    // Phase 1: extractor is a stub — real AI call wired in Phase 2
    const extractor = isGitHubFilePage() ? new GitHubDomExtractor() : new GitLabDomExtractor();
    const fileContent = extractor.extract();

    if (!fileContent || fileContent.lines.length === 0) {
      updateSidebar('error');
      return;
    }

    // Placeholder result until Phase 2 adds the AI fetch
    updateSidebar({
      summary: `${fileContent.language} file — ${fileContent.lines.length} lines. AI explanation coming in Phase 2.`,
      keyPoints: [`Language: ${fileContent.language}`, `Lines: ${fileContent.lines.length}`],
      complexity: 'low',
    });
  };

  try {
    if (!isFilePage()) return;

    const enabled = await isEnabledForHost(host);
    if (!enabled) return;

    await run();

    let navObserver: MutationObserver | null = null;

    watchForNavigation(async (newUrl: string) => {
      removeSidebar();
      if (navObserver) navObserver.disconnect();

      if (!isFilePage(newUrl)) return;

      const stillEnabled = await isEnabledForHost(host);
      if (!stillEnabled) return;

      navObserver = new MutationObserver((_, obs) => {
        if (document.querySelector('.blob-code, .blob-content')) {
          obs.disconnect();
          run();
        }
      });
      navObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => navObserver?.disconnect(), 5000);
    });
  } catch {
    // Errors must not surface to the host page
  }
})();
