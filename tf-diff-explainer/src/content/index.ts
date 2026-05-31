import {
  isEnabledForHost,
  getCachedAnalysis,
  setCachedAnalysis,
  getApiKey,
  setApiKey,
  getCachedAISummary,
  setCachedAISummary,
  toggleHost,
} from '../utils/storage';
import { isSupportedPage, hasTerraformDiff, watchForNavigation } from './pageDetector';
import {
  injectSidebar,
  showSetupPanel,
  showAnalyzing,
  showRiskMap,
  showAIReview,
  removeSidebar,
} from './sidebar/index';
import { injectStepper, setStepperStep, removeStepper } from './stepper';
import { parseDiff } from './hunkParser';
import { classifyRisks } from './riskClassifier';
import { buildDependencyGraph } from './refParser';
import { fetchAISummary, generateDiffHash } from './aiSummary';
import type { ResourceChange } from './types';

(async function init() {
  const host = location.hostname;

  type Step = 1 | 2 | 3 | 4 | 5;
  let currentStep: Step = 1;
  let generation = 0;
  let analysisResults: ResourceChange[] = [];
  let analysisComplete = false;

  async function runAnalysis(gen: number): Promise<void> {
    showAnalyzing();
    const cached = await getCachedAnalysis(location.href);
    let changes: ResourceChange[];
    if (cached) {
      changes = cached.changes;
    } else {
      changes = classifyRisks(await parseDiff());
      const graph = buildDependencyGraph(changes);
      await setCachedAnalysis(location.href, changes, graph);
    }
    if (gen !== generation) return;
    analysisResults = changes;
    analysisComplete = true;
    if (currentStep === 3) {
      currentStep = 4;
      renderStep();
    }
  }

  async function fetchAndShowAI(gen: number): Promise<void> {
    showAIReview(analysisResults, 'loading');
    if (analysisResults.length === 0) {
      showAIReview(analysisResults, 'error');
      return;
    }
    const apiKey = await getApiKey();
    if (!apiKey) {
      if (gen !== generation) return;
      showAIReview(analysisResults, 'no-key');
      return;
    }
    if (gen !== generation) return;
    const hash = await generateDiffHash(analysisResults);
    const cachedAI = await getCachedAISummary(hash);
    if (cachedAI) {
      if (gen !== generation) return;
      showAIReview(analysisResults, cachedAI);
      return;
    }
    if (gen !== generation) return;
    const aiResult = await fetchAISummary(analysisResults);
    if (gen !== generation) return;
    if (aiResult) {
      try {
        await setCachedAISummary(hash, aiResult);
      } catch (error) {
        console.warn('TFE: Failed to cache AI summary', error);
      }
    }
    showAIReview(analysisResults, aiResult ?? 'error');
  }

  async function renderStep(): Promise<void> {
    switch (currentStep) {
      case 1: {
        const gen = ++generation;
        void gen;
        removeSidebar();
        setStepperStep(1, 0);
        break;
      }
      case 2: {
        ++generation;
        const apiKey = await getApiKey();
        const siteEnabled = await isEnabledForHost(host);
        injectSidebar();
        showSetupPanel(
          host,
          async (key) => setApiKey(key),
          async (enabled) => toggleHost(host, enabled),
          apiKey,
          siteEnabled
        );
        setStepperStep(2, 1);
        break;
      }
      case 3: {
        const gen = ++generation;
        analysisComplete = false;
        setStepperStep(3, 2);
        runAnalysis(gen);
        break;
      }
      case 4: {
        ++generation;
        showRiskMap(analysisResults);
        setStepperStep(4, 3);
        break;
      }
      case 5: {
        const gen = ++generation;
        setStepperStep(5, 4);
        fetchAndShowAI(gen);
        break;
      }
    }
  }

  function advanceStep(): void {
    if (currentStep === 5) return;
    if (currentStep === 3 && !analysisComplete) return;
    currentStep = (currentStep + 1) as Step;
    renderStep();
  }

  function goBack(): void {
    if (currentStep === 1) return;
    currentStep = (currentStep - 1) as Step;
    renderStep();
  }

  function startFlow(): void {
    injectStepper(advanceStep, goBack);
    setStepperStep(1, 0);
  }

  function teardown(): void {
    removeSidebar();
    removeStepper();
    ++generation;
    currentStep = 1;
    analysisComplete = false;
    analysisResults = [];
  }

  try {
    if (!isSupportedPage()) return;

    if (hasTerraformDiff()) {
      startFlow();
    }

    let diffObserver: MutationObserver | null = null;

    watchForNavigation(async (newUrl: string) => {
      teardown();
      if (diffObserver) diffObserver.disconnect();

      if (!isSupportedPage(newUrl)) return;

      if (hasTerraformDiff()) {
        startFlow();
        return;
      }

      diffObserver = new MutationObserver((_, obs) => {
        if (hasTerraformDiff()) {
          obs.disconnect();
          startFlow();
        }
      });
      diffObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => diffObserver?.disconnect(), 5000);
    });
  } catch {
    // Swallow silently — errors must not surface to the host PR page
  }
})();
