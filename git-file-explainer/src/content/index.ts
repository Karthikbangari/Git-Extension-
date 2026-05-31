import { isFilePage, isGitHubFilePage, watchForNavigation } from './pageDetector';
import { GitHubDomExtractor, GitLabDomExtractor } from './fileExtractor';
import { injectSidebar, updateSidebar, updateQAAnswer, removeSidebar } from './sidebar/index';
import { isEnabledForHost, getApiKey, getCachedSummary, setCachedSummary } from '../utils/storage';
import { buildPrompt, fetchFileSummary, buildQAPrompt, fetchQAAnswer } from './aiSummary';

(async function init() {
  const host = location.hostname;

  const SELECTORS =
    '.blob-code-inner, td[id^="LC"], [data-testid="blob-code-content"], [data-testid="code-cell"], [data-testid="read-only-cursor-text-area"][aria-label="file content"], .blob-content .line, .blob-content td.line_content';

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

    const content = fileContent.lines.join('\n');

    const onAsk = async (question: string) => {
      updateQAAnswer('loading');
      const qaPrompt = buildQAPrompt(question, fileContent.filePath, fileContent.language, content);
      const answer = await fetchQAAnswer(qaPrompt);
      updateQAAnswer(answer ?? 'error');
    };

    const cached = await getCachedSummary(location.href);
    if (cached) {
      updateSidebar(cached, onAsk);
      return;
    }

    const prompt = buildPrompt(fileContent.filePath, fileContent.language, content);
    const result = await fetchFileSummary(prompt);

    if (result) {
      void setCachedSummary(location.href, result);
      updateSidebar(result, onAsk);
    } else {
      updateSidebar('error');
    }
  };

  let navObserver: MutationObserver | null = null;

  const handlePageChange = async (url: string) => {
    removeSidebar();
    if (navObserver) navObserver.disconnect();

    if (!isFilePage(url)) return;

    const enabled = await isEnabledForHost(host);
    if (!enabled) return;

    if (document.querySelector(SELECTORS)) {
      void run();
      return;
    }

    // Wait for the code container to be present in the DOM
    navObserver = new MutationObserver((_, obs) => {
      if (document.querySelector(SELECTORS)) {
        obs.disconnect();
        void run();
      }
    });

    navObserver.observe(document.body, { childList: true, subtree: true });

    // Fallback: stop observing after 5s if elements never appear
    setTimeout(() => navObserver?.disconnect(), 5000);
  };

  try {
    // Handle the current page state immediately
    await handlePageChange(location.href);

    // Always watch for SPA transitions, even if we didn't start on a file page
    watchForNavigation((newUrl: string) => {
      void handlePageChange(newUrl);
    });
  } catch {
    // Errors must not surface to the host page
  }
})();
