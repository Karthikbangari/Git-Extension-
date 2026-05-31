import { isFilePage, isGitHubFilePage, watchForNavigation } from './pageDetector';
import { GitHubDomExtractor, GitLabDomExtractor } from './fileExtractor';
import {
  injectSidebar,
  updateSidebar,
  updateQAAnswer,
  appendQAChunk,
  removeSidebar,
} from './sidebar/index';
import {
  isEnabledForHost,
  isRepoEnabled,
  getApiKey,
  getCachedSummaryWithMeta,
  setCachedSummary,
  getAudience,
  getAutoTrigger,
  getCustomGitLabDomain,
} from '../utils/storage';
import { buildPrompt, fetchFileSummary, buildQAPrompt, streamQAAnswer } from './aiSummary';

(async function init() {
  const host = location.hostname;
  const customDomain = await getCustomGitLabDomain().catch(() => null);

  const SELECTORS =
    '.blob-code-inner, td[id^="LC"], [data-testid="blob-code-content"], [data-testid="code-cell"], [data-testid="read-only-cursor-text-area"][aria-label="file content"], .blob-content .line, .blob-content td.line_content';

  const run = async () => {
    const extractor = isGitHubFilePage() ? new GitHubDomExtractor() : new GitLabDomExtractor();

    // Try DOM extraction first; fall back to raw.githubusercontent.com for GitHub
    let fileContent = extractor.extract();
    if ((!fileContent || fileContent.lines.length === 0) && isGitHubFilePage()) {
      fileContent = await (extractor as GitHubDomExtractor).extractWithFallback();
    }

    injectSidebar(fileContent?.filePath, fileContent?.language);

    if (!fileContent) {
      updateSidebar('no-content');
      return;
    }

    if (fileContent.isBinary) {
      updateSidebar('binary');
      return;
    }

    if (fileContent.lines.length === 0) {
      updateSidebar('no-content');
      return;
    }

    updateSidebar('loading');

    const content = extractor.buildContent(fileContent);
    const contentChars = content.length;

    const apiKey = await getApiKey();
    if (!apiKey) {
      updateSidebar(
        'no-key',
        undefined,
        fileContent.truncated,
        fileContent.originalLineCount,
        undefined,
        contentChars
      );
      return;
    }
    const audience = await getAudience();

    // Streaming Q&A with prior summary context
    let currentSummaryText: string | undefined;
    const abortCtrl = new AbortController();

    const onAsk = (question: string) => {
      updateQAAnswer('loading');
      const qaPrompt = buildQAPrompt(
        question,
        fileContent!.filePath,
        fileContent!.language,
        content,
        currentSummaryText
      );
      void streamQAAnswer(
        qaPrompt,
        (chunk) => {
          const container = document.querySelector('.gfe-qa-answer');
          if (container && container.textContent === 'Thinking…') {
            updateQAAnswer('');
          }
          appendQAChunk(chunk);
        },
        abortCtrl.signal
      ).then((full) => {
        if (full === null) updateQAAnswer('error');
        const btn = document.querySelector<HTMLButtonElement>('.gfe-qa-btn');
        if (btn) btn.disabled = false;
      });
    };

    const cached = await getCachedSummaryWithMeta(location.href);
    if (cached) {
      currentSummaryText = cached.result.summary;
      updateSidebar(
        cached.result,
        onAsk,
        fileContent.truncated,
        fileContent.originalLineCount,
        {
          fromCache: true,
          ts: cached.ts,
        },
        contentChars
      );
      return;
    }

    const prompt = buildPrompt(fileContent.filePath, fileContent.language, content, audience);
    const result = await fetchFileSummary(prompt);

    if (result) {
      currentSummaryText = result.summary;
      void setCachedSummary(location.href, result);
      updateSidebar(
        result,
        onAsk,
        fileContent.truncated,
        fileContent.originalLineCount,
        undefined,
        contentChars
      );
    } else {
      updateSidebar('error');
    }
  };

  const showManualTrigger = () => {
    injectSidebar();
    const body = document.querySelector<HTMLElement>('#git-file-explainer-sidebar .gfe-body');
    if (!body) return;
    body.textContent = '';
    const btn = document.createElement('button');
    btn.className = 'gfe-qa-btn';
    btn.style.margin = '12px auto';
    btn.style.display = 'block';
    btn.textContent = 'Explain this file';
    btn.setAttribute('aria-label', 'Explain this file');
    btn.addEventListener('click', () => void run());
    body.appendChild(btn);
  };

  let navObserver: MutationObserver | null = null;
  let navPollTimer: number | null = null;
  let navFallbackTimer: number | null = null;
  let navRunId = 0;

  const stopWaitingForCode = () => {
    navObserver?.disconnect();
    navObserver = null;
    if (navPollTimer !== null) {
      clearInterval(navPollTimer);
      navPollTimer = null;
    }
    if (navFallbackTimer !== null) {
      clearTimeout(navFallbackTimer);
      navFallbackTimer = null;
    }
  };

  const handlePageChange = async (url: string) => {
    const runId = ++navRunId;
    removeSidebar();
    stopWaitingForCode();

    if (!isFilePage(url, customDomain)) return;

    const [enabled, repoEnabled] = await Promise.all([isEnabledForHost(host), isRepoEnabled(url)]);
    if (!enabled || !repoEnabled) return;

    const autoTrigger = await getAutoTrigger();

    let triggered = false;
    const triggerExplain = () => {
      if (triggered || runId !== navRunId) return;
      triggered = true;
      stopWaitingForCode();
      autoTrigger ? void run() : showManualTrigger();
    };

    if (document.querySelector(SELECTORS)) {
      triggerExplain();
      return;
    }

    navObserver = new MutationObserver((_, obs) => {
      if (document.querySelector(SELECTORS)) {
        obs.disconnect();
        triggerExplain();
      }
    });

    navObserver.observe(document.body, { childList: true, subtree: true });

    // GitHub/GitLab SPA pages sometimes render code after the first mutation burst,
    // or update an existing container without adding a matching node. Poll too.
    navPollTimer = window.setInterval(() => {
      if (document.querySelector(SELECTORS)) triggerExplain();
    }, 500);

    navFallbackTimer = window.setTimeout(() => {
      if (!triggered && runId === navRunId && isGitHubFilePage(url)) {
        // Markdown and other preview-rendered GitHub blobs can omit code-cell DOM.
        // Running anyway lets the extractor use its raw.githubusercontent.com fallback.
        triggerExplain();
      }
    }, 30000);
  };

  // Alt+S keyboard shortcut
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.altKey && e.key === 's') {
      const sidebar = document.getElementById('git-file-explainer-sidebar');
      if (sidebar) {
        // Re-run explanation
        removeSidebar();
      }
      void run();
    }
  });

  try {
    await handlePageChange(location.href);
    watchForNavigation((newUrl: string) => {
      void handlePageChange(newUrl);
    });
  } catch {
    // Errors must not surface to the host page
  }
})();
