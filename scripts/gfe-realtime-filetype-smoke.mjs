import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const extensionDir = path.join(repoRoot, 'git-file-explainer/dist');
const screenshotDir = path.join(
  repoRoot,
  'git-file-explainer/realtime-screenshots/supported-file-types'
);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfe-realtime-filetypes-'));

fs.mkdirSync(screenshotDir, { recursive: true });

const base =
  'https://github.com/Karthikbangari/Git-Extension-/blob/main/git-file-explainer/test-fixtures/supported-file-types';

const files = [
  ['tf', 'main.tf', 'Terraform'],
  ['ts', 'index.ts', 'TypeScript'],
  ['js', 'index.js', 'JavaScript'],
  ['py', 'app.py', 'Python'],
  ['go', 'main.go', 'Go'],
  ['java', 'App.java', 'Java'],
  ['rb', 'app.rb', 'Ruby'],
  ['cs', 'Program.cs', 'C#'],
  ['cpp', 'main.cpp', 'C++'],
  ['c', 'main.c', 'C'],
  ['tsx', 'App.tsx', 'TypeScript'],
  ['jsx', 'App.jsx', 'JavaScript'],
  ['php', 'index.php', 'PHP'],
  ['json', 'package.json', 'JSON'],
  ['yaml', 'config.yaml', 'YAML'],
  ['yml', 'config.yml', 'YAML'],
  ['xml', 'layout.xml', 'XML'],
  ['sql', 'query.sql', 'SQL'],
  ['html', 'index.html', 'HTML'],
  ['css', 'style.css', 'CSS'],
  ['scss', 'style.scss', 'SCSS'],
  ['md', 'README.md', 'Markdown'],
];

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ],
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});

const page = await context.newPage();
const results = [];

for (const [ext, fileName, language] of files) {
  const url = `${base}/${fileName}`;
  const screenshot = path.join(screenshotDir, `${ext}-${fileName.replaceAll('.', '-')}.png`);
  console.log(`Opening ${fileName}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('#git-file-explainer-sidebar', { timeout: 20_000 });
  await page.waitForTimeout(1_500);

  const sidebarText = await page
    .locator('#git-file-explainer-sidebar')
    .textContent()
    .catch(() => '');
  const visible = await page.locator('#git-file-explainer-sidebar').isVisible();
  const languageSeen = sidebarText?.includes(language) ?? false;
  await page.screenshot({ path: screenshot, fullPage: false });

  const status = visible && languageSeen ? 'PASS' : visible ? 'WARN' : 'FAIL';
  results.push({
    ext,
    fileName,
    language,
    status,
    url,
    screenshot: path.relative(repoRoot, screenshot),
  });
  console.log(`${status} ${fileName} -> ${path.relative(repoRoot, screenshot)}`);
}

const reportPath = path.join(screenshotDir, 'README.md');
const generatedAt = new Date().toISOString();
const lines = [
  '# GFE Realtime File-Type Screenshots',
  '',
  `Generated: ${generatedAt}`,
  '',
  'Each screenshot was captured from a real GitHub `/blob/` URL with `git-file-explainer/dist` loaded as an unpacked Chrome extension.',
  '',
  '| Type | File | Language | Status | Screenshot | Live URL |',
  '| ---- | ---- | -------- | ------ | ---------- | -------- |',
  ...results.map(
    (r) =>
      `| .${r.ext} | \`${r.fileName}\` | ${r.language} | ${r.status} | [PNG](${path.basename(
        r.screenshot
      )}) | [Open](${r.url}) |`
  ),
  '',
];
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);

await context.close();

const failed = results.filter((r) => r.status === 'FAIL');
const warned = results.filter((r) => r.status === 'WARN');
console.log(`Screenshots: ${screenshotDir}`);
console.log(
  `Result: ${results.length - failed.length - warned.length} pass, ${warned.length} warn, ${failed.length} fail`
);
if (failed.length > 0) process.exitCode = 1;
