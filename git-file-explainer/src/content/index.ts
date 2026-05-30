import { isFilePage, isGitHubFilePage, watchForNavigation } from './pageDetector';
import { GitHubDomExtractor, GitLabDomExtractor } from './fileExtractor';
import { injectSidebar, updateSidebar, removeSidebar } from './sidebar/index';
import { isEnabledForHost, getApiKey, getCachedSummary, setCachedSummary } from '../utils/storage';
import { buildPrompt, fetchFileSummary } from './aiSummary';

(async function init() {
  const host = location.hostname;

  const run = async () => {
    injectSidebar();
    updateSidebar('loading');

    const extractor = isGitHubFilePage() ? new GitHubDomExtractor() : new GitLabDomExtractor();
    const fileContent = extractor.extract();

    if (!fileContent || fileContent.lines.length === 0) {
      updateSidebar('no-content');
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      updateSidebar('no-key');
      return;
    }

    const cached = await getCachedSummary(location.href);
    if (cached) {
      updateSidebar(cached);
      return;
    }

    const content = fileContent.lines.join('\n');
    const prompt = buildPrompt(fileContent.filePath, fileContent.language, content);
    const result = await fetchFileSummary(prompt);

    if (result) {
      void setCachedSummary(location.href, result);
      updateSidebar(result);
    } else {
      updateSidebar('error');
    }
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
        if (
          document.querySelector(
            '.blob-code-inner, td[id^="LC"], [data-testid="blob-code-content"]'
          )
        ) {
          obs.disconnect();
          void run();
        }
      });
      navObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => navObserver?.disconnect(), 5000);
    });
  } catch {
    // Errors must not surface to the host page
  }
})();
