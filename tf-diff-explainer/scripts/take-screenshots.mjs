import puppeteer from 'puppeteer-core';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const OUT = path.resolve(__dirname, '../store/screenshots');
const CHROME = '/tmp/tfe-browsers/chromium/mac_arm-1639011/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const PR_URL = 'https://github.com/terraform-aws-modules/terraform-aws-lambda/pull/577/files';

// Fresh profile so no existing Chrome state interferes
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfe-chrome-'));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  userDataDir,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--load-extension=${DIST}`,
    `--disable-extensions-except=${DIST}`,
    '--window-size=1280,900',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
  ],
  defaultViewport: { width: 1280, height: 800 },
});

// Log actual Chrome args for debugging
const version = await browser.version();
console.log('Browser version:', version);

const [page] = await browser.pages();
await page.setViewport({ width: 1280, height: 800 });

// Verify extension targets loaded
const allTargets = await browser.targets();
const extTargets = allTargets.filter(t => t.url().startsWith('chrome-extension://'));
console.log('Extension targets:', extTargets.map(t => ({ type: t.type(), url: t.url() })));

// Capture all console messages from the page (includes extension content script output)
page.on('console', msg => console.log(`[PAGE ${msg.type()}]`, msg.text()));
page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

console.log('Navigating to PR…');
await page.goto(PR_URL, { waitUntil: 'networkidle2', timeout: 30000 });
console.log('Final URL:', page.url());

// Wait for GitHub diff to render
await page.waitForSelector('.file', { timeout: 15000 });
console.log('Diff files found:', await page.$$eval('.file', els => els.length));

// Check if extension content script is running
const sidebarPresent = await page.evaluate(() => !!document.querySelector('#tf-diff-explainer-sidebar'));
console.log('Sidebar in DOM:', sidebarPresent);

// Check raw DOM for .tf files
const tfFiles = await page.$$eval('.file', els =>
  els.map(el => el.getAttribute('data-path') ||
    el.querySelector('.file-header a[title]')?.title ||
    el.querySelector('.file-header .Truncate-text')?.textContent?.trim() || '?'
  ).filter(p => p.endsWith('.tf'))
);
console.log('.tf files detected:', tfFiles);

// Allow content script time to inject sidebar
await new Promise(r => setTimeout(r, 6000));

const sidebarAfter = await page.evaluate(() => !!document.querySelector('#tf-diff-explainer-sidebar'));
console.log('Sidebar after wait:', sidebarAfter);

// Screenshot 1 — full sidebar + minimap
await page.screenshot({ path: `${OUT}/01-sidebar-risk-minimap.png`, fullPage: false });
console.log('Shot 1 saved');

// Shot 2 — zoomed-in close-up of the sidebar (4× deviceScaleFactor on a 320×200 clip → 1280×800)
const sidebarRect = await page.evaluate(() => {
  const sidebar = document.getElementById('tf-diff-explainer-sidebar');
  if (!sidebar) return null;
  const r = sidebar.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
console.log('Sidebar rect:', sidebarRect);
if (sidebarRect) {
  // Clip the full sidebar height up to 200px (fits 320×200 → 1280×800 at 4×)
  const clipH = Math.min(sidebarRect.h, 200);
  // Position clip to start ~60% down to show minimap + AI section
  const clipY = sidebarRect.y + Math.round(sidebarRect.h * 0.72);
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 4 });
  await page.screenshot({
    path: `${OUT}/02-ai-summary-close.png`,
    clip: { x: sidebarRect.x, y: clipY, width: sidebarRect.w, height: clipH },
  });
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
} else {
  await page.screenshot({ path: `${OUT}/02-ai-summary-close.png`, fullPage: false });
}
console.log('Shot 2 saved');

// Screenshot 3 — popup
// Open the extension popup via chrome.action (need extension ID first)
const targets = await browser.targets();
const extTarget = targets.find(t => t.type() === 'service_worker' || t.url().startsWith('chrome-extension://'));
let popupUrl = null;
if (extTarget) {
  const extId = extTarget.url().split('/')[2];
  popupUrl = `chrome-extension://${extId}/popup/popup.html`;
  console.log('Extension ID:', extId);
}

if (popupUrl) {
  // Navigate directly to popup URL; inject a centering wrapper so it sits on a
  // 1280×800 canvas (CWS minimum screenshot dimension)
  const popupPage = await browser.newPage();
  await popupPage.setViewport({ width: 1280, height: 800 });
  await popupPage.goto(popupUrl, { waitUntil: 'networkidle0', timeout: 10000 });
  // Wrap popup content in a centred card on a neutral background
  await popupPage.evaluate(() => {
    const content = document.body.innerHTML;
    document.body.innerHTML = `
      <div id="canvas" style="
        width:1280px;height:800px;background:#e8eaed;
        display:flex;align-items:center;justify-content:center;
        position:fixed;top:0;left:0;box-sizing:border-box;">
        <div id="card" style="
          width:400px;background:#fff;border-radius:10px;
          box-shadow:0 6px 32px rgba(0,0,0,.18);overflow:hidden;">
          ${content}
        </div>
      </div>`;
  });
  await new Promise(r => setTimeout(r, 800));
  await popupPage.screenshot({ path: `${OUT}/03-popup.png` });
  console.log('Shot 3 saved');
  await popupPage.close();
}

await browser.close();
console.log('Done. Screenshots at', OUT);
