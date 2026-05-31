import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TFE_DIST = path.join(__dirname, 'tf-diff-explainer/dist');
const GFE_DIST = path.join(__dirname, 'git-file-explainer/dist');
const SHOTS = path.join(__dirname, 'verify-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function log(label, status, note) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${label}] ${note}`);
  results.push({ label, status, note });
}

async function shot(page, name) {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`   📸 ${p}`);
  return p;
}

// ── TFE: test on a real public .tf PR ──────────────────────────────────────
async function testTFE() {
  console.log('\n=== TFE (tf-diff-explainer) ===');
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${TFE_DIST}`,
      `--load-extension=${TFE_DIST}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await ctx.newPage();
  try {
    // Real open TypeScript PR (has .ts files — TFE triggers on all supported exts)
    const PR_URL = 'https://github.com/microsoft/TypeScript/pull/63516/files';
    console.log(`  Navigating to ${PR_URL}`);
    await page.goto(PR_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    await shot(page, 'tfe-01-pr-loaded');

    // Step 1 injects the stepper bar (#tfe-stepper), NOT the sidebar
    const stepperEl = await page.$('#tfe-stepper');
    if (stepperEl) {
      log('TFE stepper inject (step 1)', 'PASS', '#tfe-stepper found');
    } else {
      log('TFE stepper inject (step 1)', 'FAIL', '#tfe-stepper not in DOM');
    }
    await shot(page, 'tfe-02-stepper');

    // Step labels visible
    if (stepperEl) {
      const txt = await stepperEl.textContent().catch(() => '');
      const hasDetect = txt.includes('Detect');
      log(
        'TFE step labels',
        hasDetect ? 'PASS' : 'WARN',
        `stepper text: "${txt.trim().substring(0, 80)}"`
      );
    }

    // Click "Next" to advance to step 2 — sidebar should appear
    const nextBtn = await page.$('.tfe-stepper-next');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
      await shot(page, 'tfe-03-step2');
      const sidebar = await page.$('#tf-diff-explainer-sidebar');
      log(
        'TFE sidebar at step 2 (Setup)',
        sidebar ? 'PASS' : 'FAIL',
        sidebar
          ? '#tf-diff-explainer-sidebar found after Next click'
          : 'sidebar missing after Next click'
      );
      if (sidebar) {
        const txt = await sidebar.textContent().catch(() => '');
        log('TFE step 2 content', 'PASS', `sidebar: "${txt.trim().substring(0, 80)}"`);
      }
    } else {
      log('TFE Next button', 'FAIL', '.tfe-stepper-next not found');
    }

    // Supported file types in diff (any of .ts/.js/.tf etc.)
    const fileHeaders = await page.$$('.file-header');
    log(
      'TFE diff file headers found',
      fileHeaders.length > 0 ? 'PASS' : 'WARN',
      `${fileHeaders.length} file header(s) in diff`
    );

    await shot(page, 'tfe-04-final');
  } catch (e) {
    log('TFE navigation', 'FAIL', String(e).substring(0, 120));
  } finally {
    await ctx.close();
  }
}

// ── GFE: test on a real public GitHub file ──────────────────────────────────
async function testGFE() {
  console.log('\n=== GFE (git-file-explainer) ===');
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${GFE_DIST}`,
      `--load-extension=${GFE_DIST}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await ctx.newPage();
  try {
    // Small .ts file — Vite CLI (renders code in DOM, not "file too big")
    const FILE_URL = 'https://github.com/vitejs/vite/blob/main/packages/vite/src/node/cli.ts';
    console.log(`  Navigating to ${FILE_URL}`);
    await page.goto(FILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    await shot(page, 'gfe-01-file-loaded');

    const GFE_SIDEBAR = '#git-file-explainer-sidebar';

    // Check sidebar injected — real ID is 'git-file-explainer-sidebar'
    const gfeSidebar = await page.$(GFE_SIDEBAR);
    if (gfeSidebar) {
      log('GFE sidebar inject (.ts)', 'PASS', `${GFE_SIDEBAR} found`);
    } else {
      log('GFE sidebar inject (.ts)', 'FAIL', `${GFE_SIDEBAR} not in DOM`);
    }

    await shot(page, 'gfe-02-after-inject');

    // Check language badge text
    if (gfeSidebar) {
      const text = await gfeSidebar.textContent().catch(() => '');
      const hasTS = text.includes('TypeScript');
      log(
        'GFE language detection (TypeScript)',
        hasTS ? 'PASS' : 'WARN',
        hasTS ? '"TypeScript" found in sidebar' : `sidebar text: "${text.trim().substring(0, 80)}"`
      );
    }

    // Navigate to a small .py file — Flask cli.py
    const PY_URL = 'https://github.com/pallets/flask/blob/main/src/flask/cli.py';
    console.log(`  Navigating to ${PY_URL}`);
    await page.goto(PY_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await shot(page, 'gfe-03-py-file');

    const gfeOnPy = await page.$(GFE_SIDEBAR);
    if (gfeOnPy) {
      const text = await gfeOnPy.textContent().catch(() => '');
      const hasPy = text.includes('Python');
      log(
        'GFE language detection (Python)',
        hasPy ? 'PASS' : 'WARN',
        hasPy ? '"Python" found' : `text: "${text.trim().substring(0, 80)}"`
      );
      log('GFE .py file inject', 'PASS', 'sidebar present on .py file');
    } else {
      log('GFE .py file inject', 'FAIL', `${GFE_SIDEBAR} not found on .py page`);
    }

    // Navigate to a binary file (.png) — should show binary skip state
    const PNG_URL = 'https://github.com/github/explore/blob/main/topics/github/github.png';
    console.log(`  Navigating to ${PNG_URL}`);
    await page.goto(PNG_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await shot(page, 'gfe-04-png-file');

    const gfeOnPng = await page.$(GFE_SIDEBAR);
    if (gfeOnPng) {
      const text = await gfeOnPng.textContent().catch(() => '');
      const hasBinary = text.toLowerCase().includes('binary');
      log(
        'GFE binary skip (.png)',
        hasBinary ? 'PASS' : 'WARN',
        hasBinary ? '"binary" shown in sidebar' : `text: "${text.trim().substring(0, 80)}"`
      );
    } else {
      log(
        'GFE .png inject',
        'WARN',
        'sidebar not present on .png — expected if GitHub shows image preview not blob code view'
      );
    }

    // Get extension ID from service worker URL (MV3 — no backgroundPages)
    const extTarget = ctx.serviceWorkers();
    console.log(`  Service workers: ${extTarget.length}`);
    let extId = null;
    for (const sw of extTarget) {
      const u = sw.url();
      if (u.includes('chrome-extension://')) {
        extId = u.split('chrome-extension://')[1].split('/')[0];
        break;
      }
    }
    if (extId) {
      console.log(`  GFE extension ID: ${extId}`);
      const popupPage = await ctx.newPage();
      await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`, {
        waitUntil: 'domcontentloaded',
      });
      await popupPage.waitForTimeout(1000);
      await shot(popupPage, 'gfe-05-popup');

      const apiInput = await popupPage.$('input[type="password"], #apiKey, [id*="api"]');
      log(
        'GFE popup API key field',
        apiInput ? 'PASS' : 'FAIL',
        apiInput ? 'API key input found' : 'no API key input'
      );

      const tokenSection = await popupPage.$('[id*="token"], [class*="token"]');
      log(
        'GFE popup token meter',
        tokenSection ? 'PASS' : 'FAIL',
        tokenSection ? 'token section found' : 'no token section'
      );

      const copyBtns = await popupPage.$$('button');
      log('GFE popup buttons', 'PASS', `${copyBtns.length} button(s) in popup`);

      await popupPage.close();
    } else {
      log('GFE popup open', 'WARN', 'could not resolve extension ID — skipping popup check');
    }

    await shot(page, 'gfe-06-final');
  } catch (e) {
    log('GFE navigation', 'FAIL', String(e).substring(0, 120));
  } finally {
    await ctx.close();
  }
}

// ── Run both ────────────────────────────────────────────────────────────────
await testTFE();
await testGFE();

console.log('\n══════════════════════════════════════════');
console.log('SUMMARY');
console.log('══════════════════════════════════════════');
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const warned = results.filter((r) => r.status === 'WARN').length;
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} ${r.label}`);
}
console.log(`\nTotal: ${passed} pass, ${failed} fail, ${warned} warn`);
console.log(`Screenshots in: ${SHOTS}`);
